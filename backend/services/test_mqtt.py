from mqtt_service import connect, push_client_command

if __name__ == "__main__":
    connect()
    push_client_command("testclient", "ping", {"msg": "Hej fra GitHub Actions!"})
