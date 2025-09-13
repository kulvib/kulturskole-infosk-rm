from flask import Blueprint, jsonify

rooms_bp = Blueprint('rooms', __name__)

# Dummy data - kan evt. komme fra database på sigt
DUMMY_ROOMS = [
    {"room_id": "musik1", "name": "Musiklokale 1"},
    {"room_id": "dans2", "name": "Dansesal 2"},
]

@rooms_bp.route("/api/rooms", methods=["GET"])
def get_rooms():
    return jsonify(DUMMY_ROOMS)
