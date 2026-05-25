import os
import math
from datetime import datetime, timezone
from flask import Flask, jsonify
from flask_cors import CORS
import spiceypy as spice

PORT_NUMBER = 5000
EARTH_ID = 399
MARS_ID = 4
KERNEL_DIR = "kernels"
KERNEL_FILES = [
    "naif0012.tls",
    "pck00010.tpc",
    "de432s.bsp",
]

app = Flask(__name__)
CORS(app)


def load_kernels():
    for filename in KERNEL_FILES:
        full_path = os.path.join(KERNEL_DIR, filename)
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Brak kernela: {full_path}")
        spice.furnsh(full_path)
        print(f"Kernel loaded: {filename}")


def current_et():
    now_utc = datetime.now(timezone.utc)
    utc_string = now_utc.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]
    et = spice.str2et(utc_string)
    return et, utc_string


def get_body_position(body_id, et):
    state, _ = spice.spkgeo(body_id, et, "J2000", 0)
    return {
        "x": float(state[0]),
        "y": float(state[1]),
        "z": float(state[2]),
        "vx": float(state[3]),
        "vy": float(state[4]),
        "vz": float(state[5]),
    }


def calculate_distance(a, b):
    dx = b["x"] - a["x"]
    dy = b["y"] - a["y"]
    dz = b["z"] - a["z"]
    return math.sqrt(dx * dx + dy * dy + dz * dz)


@app.route("/positions")
def positions():
    et, utc_string = current_et()
    earth = get_body_position(EARTH_ID, et)
    mars = get_body_position(MARS_ID, et)
    distance_km = calculate_distance(earth, mars)
    return jsonify(
        {
            "utc": utc_string,
            "frame": "J2000",
            "units": "km",
            "earth": earth,
            "mars": mars,
            "distance_km": distance_km,
        }
    )

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

if __name__ == "__main__":

    print("===================================")
    print("MARS DISTANCE API")
    print("===================================")

    load_kernels()

    app.run(host="0.0.0.0", port=PORT_NUMBER, debug=True)
