import requests

AU_TO_KM = 149_597_870.7


def fetch_distance_km(timestamp: str) -> float:
    url = "https://ssd.jpl.nasa.gov/api/horizons.api"

    params = {
        "format": "json",         # format odpowiedzi (JSON zamiast tekstu)
        "COMMAND": "'499'",       # obiekt docelowy: 499 = Mars
        "MAKE_EPHEM": "YES",      # generuj efemerydy (dane w czasie)
        "EPHEM_TYPE": "OBSERVER", # dane z perspektywy obserwatora
        "CENTER": "'399'",        # obserwator: 399 = Ziemia
        "TLIST": f"'{timestamp}'",# moment czasu (UTC), np. '2026-03-18 13:51'
        "QUANTITIES": "'20'"      # interesuje nas tylko kolumna z odległością (delta)
    }

    response = requests.get(url, params=params)
    response.raise_for_status()

    data = response.json()
    return extract_distance_km(data["result"])


def extract_distance_km(response: str) -> float:
    lines = response.splitlines()
    in_data = False

    for line in lines:
        line = line.strip()

        if line == "$$SOE":
            in_data = True
            continue
        if line == "$$EOE":
            break

        if in_data and line:
            parts = line.split()

            if len(parts) >= 3:
                return float(parts[2]) * AU_TO_KM

    raise ValueError("Nie znaleziono danych delta")


if __name__ == "__main__":
    print(fetch_distance_km("2026-03-18 13:51"))