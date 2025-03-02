ARG BASE_IMAGE='python:3-alpine'
FROM $BASE_IMAGE AS spark-base
LABEL maintainer="Bolaji Aina <neoandey@yahoo.com>"

ARG FLASK_APP=wblester.py
ARG FLASK_ENV=production
ARG MONGODB_URL
ARG MONGODB_DB
ARG MONGODB_HOST
ARG MONGODB_PORT
ARG MONGODB_USERNAME
ARG MONGODB_PASSWORD
ARG MONGODB_USE_SSL
ARG MONGODB_REPLICASET
ARG MONGODB_DIRECT_CONNECTION
ARG MONGODB_AUTH_MECHANISM
ARG SESSION_TYPE
ARG REDIS_URL
ARG REDIS_QUEUE_NAME
ARG PORT
ARG GPG_KEY

ENV FLASK_APP=$FLASK_APP
ENV FLASK_ENV=$FLASK_ENV
ENV MONGODB_URL=$MONGODB_URL
ENV MONGODB_DB=$MONGODB_DB
ENV MONGODB_HOST=$MONGODB_HOST
ENV MONGODB_PORT=$MONGODB_PORT
ENV MONGODB_USERNAME=$MONGODB_USERNAME
ENV MONGODB_PASSWORD=$MONGODB_PASSWORD
ENV MONGODB_USE_SSL=$MONGODB_USE_SSL
ENV MONGODB_REPLICASET=$MONGODB_REPLICASET
ENV MONGODB_DIRECT_CONNECTION=$MONGODB_DIRECT_CONNECTION
ENV MONGODB_AUTH_MECHANISM=$MONGODB_DIRECT_CONNECTION
ENV SESSION_TYPE=$SESSION_TYPE
ENV REDIS_URL=$REDIS_URL
ENV REDIS_QUEUE_NAME=$REDIS_QUEUE_NAME
ENV PORT=$PORT
ENV GPG_KEY=$GPG_KEY

RUN  mkdir -p "/opt/$APP_NAME/app"  &&  mkdir -p "opt/$APP_NAME/settings" &&  apk update && apk upgrade && apk add --no-cache --update bash \
   gcc \
   libcurl \
   python3-dev \
   gpgme-dev \
   libc-dev \
   g++ \
   libxslt-dev \
   libxslt-dev \
   libffi-dev \
   freetype-dev \
   libpng-dev \
   jpeg-dev \
   libjpeg-turbo-dev\
   zlib-dev \
   busybox-extras \
   procps \
   curl

COPY ["./config.py","./$FLASK_APP","./Procfile","./redis_worker.py","./requirements.txt", "/opt/$APP_NAME/"]
COPY ["./settings","/opt/$APP_NAME/settings"]
COPY ["./app",  "/opt/$APP_NAME/app"]
RUN  python -m pip install --upgrade pip &&  python -m pip install -r  /opt/$APP_NAME/requirements.txt && pip install -U setuptools && apk add bash &&  eval '(ls /usr/local/lib | grep python| tail -1 >/tmp/python)'  && sed -i -e 's/flask.json/json/g' "/usr/local/lib/$(cat /tmp/python)/site-packages/flask_mongoengine/json.py" &&  \
     for filename in /opt/$APP_NAME/settings/*; do gpg --quiet --batch --yes --decrypt --passphrase=${GPG_KEY}  --output ${filename/.gpg/} "$filename" && rm -f "$filename"; done && \
     chmod -R 0777 /opt/$APP_NAME/settings/
WORKDIR /opt/$APP_NAME
EXPOSE $PORT 6379 443 80
#CMD python redis_worker.py & gunicorn -w 2 -b 0.0.0.0:$PORT  $APP_NAME:app
COPY entrypoint.sh .
	
ENTRYPOINT  ["./entrypoint.sh"]

#CMD ['/bin/bash']