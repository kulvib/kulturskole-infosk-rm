FROM guacamole/guacamole:latest

USER root

RUN apt-get update && apt-get install -y guacd && apt-get clean

COPY guacamole-auth-jdbc-postgresql-1.5.4.jar /etc/guacamole/extensions/guacamole-auth-jdbc-postgresql-1.5.4.jar
COPY guacamole.properties /etc/guacamole/guacamole.properties

EXPOSE 8080 4822

CMD service guacd start && /opt/guacamole/bin/start.sh
