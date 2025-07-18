from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required
import datetime

app = Flask(__name__)
app.config["JWT_SECRET_KEY"] = "megethemskhemmelig"
CORS(app)
jwt = JWTManager(app)

clients = {}

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    if data["username"] == "admin" and data["password"] == "admin123":
        access_token = create_access_token(identity=data["username"])
        return jsonify(access_token=access_token)
    return jsonify(msg="Bad credentials"), 401

@app.route("/api/heartbeat", methods=["POST"])
@jwt_required()
def heartbeat():
    data = request.get_json()
    clients[data["unique_id"]] = data
    return jsonify(status="ok")

@app.route("/api/clients", methods=["GET"])
@jwt_required()
def get_clients():
    return jsonify(clients=list(clients.values()))

if __name__ == "__main__":
    app.run(debug=True)
