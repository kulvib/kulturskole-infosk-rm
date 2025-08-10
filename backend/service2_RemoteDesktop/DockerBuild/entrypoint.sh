#!/bin/sh
# Erstat miljøvariabler i guacamole.properties
envsubst < /etc/guacamole/guacamole.properties > /etc/guacamole/guacamole.properties.subst
mv /etc/guacamole/guacamole.properties.subst /etc/guacamole/guacamole.properties
exec /usr/local/tomcat/bin/catalina.sh run
