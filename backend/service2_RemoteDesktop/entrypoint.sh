#!/bin/sh
# Erstat environment-variabler i guacamole.properties
envsubst < /etc/guacamole/guacamole.properties > /etc/guacamole/guacamole.properties.subst
mv /etc/guacamole/guacamole.properties.subst /etc/guacamole/guacamole.properties
# Start Tomcat/Guacamole
exec /usr/local/tomcat/bin/catalina.sh run
