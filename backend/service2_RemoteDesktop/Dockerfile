FROM guacamole/guacamole:latest

USER root
RUN apt-get update && apt-get install -y guacd && apt-get clean

EXPOSE 8080

CMD guacd & /opt/guacamole/bin/guacamole.sh
