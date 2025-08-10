FROM guacamole/guacamole:latest

USER root

RUN apt-get update && apt-get install -y gettext

COPY guacamole-auth-jdbc-postgresql-1.6.0.jar /etc/guacamole/extensions/guacamole-auth-jdbc-postgresql-1.6.0.jar
COPY postgresql-42.7.3.jar /etc/guacamole/extensions/postgresql-42.7.3.jar
COPY guacamole.properties /etc/guacamole/guacamole.properties

EXPOSE 8080
