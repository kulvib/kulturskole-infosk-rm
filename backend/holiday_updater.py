import requests
import json
from datetime import datetime

def fetch_holidays(year, country="DK"):
    url = f"https://date.nager.at/api/v3/PublicHolidays/{year}/{country}"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()

if __name__ == "__main__":
    holidays = []
    for year in range(datetime.now().year, 2051):
        holidays.extend(fetch_holidays(year))
    with open("holidays.json", "w") as f:
        json.dump(holidays, f, indent=2, ensure_ascii=False)
