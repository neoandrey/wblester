#!/bin/bash
MODE=$1
echo "MODE: $MODE"

if [ "$MODE" == "both" ]
then
    #python -m flask run -p $PORT 
    python redis_worker.py & gunicorn -w 1 -b 0.0.0.0:$PORT --timeout 120 --threads=3 --worker-connections=1000 $FLASK_APP:app
   
else

    if [ "$MODE" == "web" ]
    then
        #python -m flask run -p $PORT 
        gunicorn -w 1 -b 0.0.0.0:$PORT --timeout 120 --threads=3 --worker-connections=1000  $FLASK_APP:app
    else
        if [ "$MODE" == "worker" ];
            then
            python redis_worker.py 
        else

            echo "Specify a mode"
                
        fi
    fi
fi