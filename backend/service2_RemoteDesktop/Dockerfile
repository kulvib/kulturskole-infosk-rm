FROM guacamole/guacamole:latest

USER root

RUN apt-get update && apt-get install -y guacd && apt-get clean

COPY guacamole-auth-jdbc-postgresql-1.6.0.jar /etc/guacamole/extensions/guacamole-auth-jdbc-postgresql-1.6.0.jar
COPY guacamole.properties /etc/guacamole/guacamole.properties
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

EXPOSE 8080 4822

ENTRYPOINT ["/entrypoint.sh"]
