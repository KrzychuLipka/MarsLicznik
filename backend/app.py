import os
import math
import atexit
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Query

import spiceypy as spice

# =========================================================
# CONFIG
# =========================================================

PORT_NUMBER = 5000

EARTH_ID = 399
MARS_ID = 4
SUN_ID = 10

KERNEL_DIR = "kernels"

KERNEL_FILES = [
    "naif0012.tls",
    "pck00010.tpc",
    "de432s.bsp",
]

# Mars orbital period ~= 687 days
# 17000h ~= 708 days
DEFAULT_STEPS = 17000
DEFAULT_STEP_HOURS = 1.0

MAX_STEPS = 50000

# =========================================================
# APP
# =========================================================

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # możesz ograniczyć później
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# GLOBAL STATE
# =========================================================

kernels_loaded = False
BASE_ET = None

# =========================================================
# SPICE SETUP
# =========================================================


def load_kernels():
    global kernels_loaded
    global BASE_ET

    if kernels_loaded:
        return

    print("===================================")
    print("LOADING SPICE KERNELS")
    print("===================================")

    for filename in KERNEL_FILES:

        full_path = os.path.join(KERNEL_DIR, filename)

        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Missing kernel: {full_path}")

        spice.furnsh(full_path)

        print(f"Loaded: {filename}")

    # deterministic epoch
    BASE_ET = spice.str2et("2025-01-01T00:00:00")

    kernels_loaded = True

    print("===================================")
    print("SPICE READY")
    print("===================================")


def unload_kernels():
    try:
        spice.kclear()
        print("SPICE kernels unloaded")
    except Exception:
        pass


atexit.register(unload_kernels)

# =========================================================
# TIME
# =========================================================


def current_et():

    now_utc = datetime.now(timezone.utc)

    utc_string = now_utc.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]

    et = spice.str2et(utc_string)

    return et, utc_string


# =========================================================
# SPACE MATH
# =========================================================


def get_body_position(body_id, et):

    state, _ = spice.spkgeo(body_id, et, "J2000", SUN_ID)

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


# =========================================================
# ROUTES
# =========================================================


@app.get("/health")
def health():
    return {"status": "ok", "spice_loaded": kernels_loaded}


@app.get("/positions")
def positions():

    if not kernels_loaded:
        load_kernels()

    et, utc_string = current_et()

    earth = get_body_position(EARTH_ID, et)

    mars = get_body_position(MARS_ID, et)

    distance_km = calculate_distance(earth, mars)

    return {
        "utc": utc_string,
        "frame": "J2000",
        "observer": "SUN",
        "units": "km",
        "earth": earth,
        "mars": mars,
        "distance_km": distance_km,
    }


@app.get("/trajectory")
def trajectory(
    steps: int = Query(DEFAULT_STEPS, le=MAX_STEPS),
    step_hours: float = Query(DEFAULT_STEP_HOURS),
    days_offset: float = Query(0.0),
):

    if not kernels_loaded:
        load_kernels()

    # =====================================================
    # VALIDATION
    # =====================================================

    if steps < 10:
        return {"error": "steps must be >= 10"}, 400

    if steps > MAX_STEPS:
        return {"error": f"steps too large (max {MAX_STEPS})"}, 400

    if step_hours <= 0:
        return {"error": "step_hours must be > 0"}, 400

    # =====================================================
    # TIMELINE
    # =====================================================

    et_start = BASE_ET + (days_offset * 86400.0)

    earth_positions = []
    mars_positions = []

    # =====================================================
    # ORBIT GENERATION
    # =====================================================

    for i in range(steps):

        et = et_start + (i * step_hours * 3600.0)

        earth = get_body_position(EARTH_ID, et)

        mars = get_body_position(MARS_ID, et)

        earth_positions.append(
            {
                "x": earth["x"],
                "y": earth["y"],
                "z": earth["z"],
            }
        )

        mars_positions.append(
            {
                "x": mars["x"],
                "y": mars["y"],
                "z": mars["z"],
            }
        )

    # =====================================================
    # RESPONSE
    # =====================================================

    total_hours = steps * step_hours
    total_days = total_hours / 24.0

    return {
        "frame": "J2000",
        "observer": "SUN",
        "units": "km",
        "base_et": BASE_ET,
        "steps": steps,
        "step_hours": step_hours,
        "days_offset": days_offset,
        "total_days": total_days,
        "earth": earth_positions,
        "mars": mars_positions,
    }


# =========================================================
# MAIN
# =========================================================

if __name__ == "__main__":

    print("===================================")
    print("NASA SPICE ORBITAL API")
    print("===================================")

    load_kernels()

    app.run(host="0.0.0.0", port=PORT_NUMBER, debug=True)
