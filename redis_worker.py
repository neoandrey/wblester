from redis.commands.search.field import TextField
from redis.commands.search.indexDefinition import IndexDefinition, IndexType
from redis import Redis
from redis.retry import Retry
from redis.exceptions import TimeoutError, ConnectionError
from redis.backoff import ExponentialBackoff
from rq import Queue, Worker
from config import Config
from datetime import datetime
from app import create_app, db
import os


def check_ping(hostname):
    response = -1
    pingstatus = False
    try:
        response = os.system("ping -c 1 " + hostname)
    except:
        pass
    if response == 0:
        pingstatus = True  # "Network Active"
    else:
        pingstatus = False  # "Network Error"
    return pingstatus


app = create_app(is_redis=True)
app.app_context().push()

# print(Config.REDIS_URL)
# redis = Redis.from_url(Config.REDIS_URL)
# check connections
# for record in db.connection.get_default_database().get_collection("Images").find({}):
#    print(record)

redis_url = Config.REDIS_URL
temp_redis_url = redis_url.replace("redis://", "")
temp_redis_url = temp_redis_url.replace("rediss://", "")
credential_portion = temp_redis_url.split("@")[0]

host_portion = temp_redis_url.split("@")[1]
redis_user = credential_portion.split(":")[0]
redis_pass = credential_portion.split(":")[1]
redis_host = host_portion.split(":")[0]
redis_port = host_portion.split(":")[1]

redis = Redis(
    host=redis_host,
    port=redis_port,
    username=redis_user,
    password=redis_pass,
    db=0,
    socket_connect_timeout=(3 * 3600),
    socket_timeout=(3 * 3600),
    retry=Retry(ExponentialBackoff(cap=10, base=1), 25),
    retry_on_error=[ConnectionError, TimeoutError, ConnectionResetError],
    health_check_interval=(60 * 5),
    socket_keepalive=1000,
    retry_on_timeout=True,
)
app.redis = redis

queue = Queue(Config.REDIS_QUEUE_NAME, connection=redis)
worker_name = datetime.now().strftime("%Y%m%d_%H%M%S")
worker = Worker([queue], connection=redis, name=worker_name)
worker.work()
