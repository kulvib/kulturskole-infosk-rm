FROM guacamole/guacamole:latest

USER root

RUN apt-get update && apt-get install -y gettext

# Guacamole JDBC PostgreSQL extension
COPY guacamole-auth-jdbc-postgresql-1.6.0.jar /etc/guacamole/extensions/guacamole-auth-jdbc-postgresql-1.6.0.jar

# PostgreSQL JDBC driver SKAL ligge i /lib
COPY postgresql-42.7.3.jar /etc/guacamole/lib/postgresql-42.7.3.jar

# Din Guacamole config
COPY guacamole.properties /etc/guacamole/guacamole.properties

EXPOSE 8080
