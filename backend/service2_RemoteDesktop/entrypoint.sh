#!/bin/sh
# Erstat environment-variabler i guacamole.properties
envsubst < /etc/guacamole/guacamole.properties > /etc/guacamole/guacamole.properties.subst
mv /etc/guacamole/guacamole.properties.subst /etc/guacamole/guacamole.properties
# Start container med standard kommando
exec /opt/guacamole/bin/guacamole
