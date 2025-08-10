#!/bin/sh
envsubst < /etc/guacamole/guacamole.properties > /etc/guacamole/guacamole.properties.new
mv /etc/guacamole/guacamole.properties.new /etc/guacamole/guacamole.properties
exec /usr/local/tomcat/bin/catalina.sh run
