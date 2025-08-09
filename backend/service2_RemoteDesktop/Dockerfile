FROM guacamole/guacamole:latest

USER root

# Installer guacd (Guacamole Daemon)
RUN apt-get update && apt-get install -y guacd && apt-get clean

# Download JDBC extension til PostgreSQL
ADD https://downloads.apache.org/guacamole/1.5.4/binary/guacamole-auth-jdbc-postgresql-1.5.4.jar /etc/guacamole/extensions/guacamole-auth-jdbc-postgresql-1.5.4.jar

# Kopier guacamole.properties ind
COPY guacamole.properties /etc/guacamole/guacamole.properties

EXPOSE 8080 4822

# Start både guacd og Guacamole web-app
CMD service guacd start && /opt/guacamole/bin/start.sh
