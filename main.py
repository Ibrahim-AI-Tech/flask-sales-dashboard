from flask import Flask, jsonify, render_template
import requests
import os
from dotenv import load_dotenv
from datetime import datetime
from dateutil import parser as date_parser

app = Flask(__name__)
load_dotenv()

# ✅ تحميل الـ API Key من ملف .env
HUBSPOT_API_KEY = os.getenv("HUBSPOT_API_KEY")

HEADERS = {
    "Authorization": f"Bearer {HUBSPOT_API_KEY}",
    "Content-Type": "application/json"
}

owners_cache = {}

# ✅ تحميل كل الـ owners مرة واحدة
def load_all_owners():
    url = "https://api.hubapi.com/crm/v3/owners"
    owners = {}
    after = None

    while True:
        params = {"limit": 100}
        if after:
            params["after"] = after

        res = requests.get(url, headers=HEADERS, params=params)
        if res.status_code != 200:
            print("❌ Failed to load owners:", res.text)
            break

        data = res.json()
        for owner in data.get("results", []):
            owner_id = str(owner["id"])
            name = owner.get("firstName", "") + " " + owner.get("lastName", "")
            owners[owner_id] = name.strip()

        paging = data.get("paging")
        if paging and "next" in paging:
            after = paging["next"]["after"]
        else:
            break

    return owners

@app.before_request
def init_owners():
    global owners_cache
    if not owners_cache:
        owners_cache = load_all_owners()
        

def get_owner_name(owner_id):
    return owners_cache.get(str(owner_id), "Unknown")

@app.route('/')
def index():
    return render_template("index.html")

@app.route('/data')
def get_monthly_closed_won_deals():
    # ✅ قيمة dealstage اللي معناها "Converted" (Closed Won)
    CLOSED_WON_STAGE = "2055465198"

    # ✅ الأسماء المسموح بها فقط واسمهم الأول بالإنجليزي
    ALLOWED_NAMES = {
        "سهيلة اشرف": "sohaila",
        "Noha Reda": "noha",
        "Bela saleh": "bela",
        "RADWA EL BIOMEY": "radwa"
    }

    now = datetime.now()
    current_year = now.year
    current_month = now.month

    sales_by_owner = {}
    url = "https://api.hubapi.com/crm/v3/objects/deals"
    params = {
        "properties": "amount,hubspot_owner_id,dealstage,closedate",
        "limit": 100
    }

    while True:
        response = requests.get(url, headers=HEADERS, params=params)
        if response.status_code != 200:
            print(f"❌ Failed to fetch deals: {response.status_code}")
            return jsonify([])

        deals_data = response.json()

        for deal in deals_data.get("results", []):
            props = deal.get("properties", {})
            dealstage = props.get("dealstage")
            closedate = props.get("closedate")
            amount = props.get("amount")
            owner_id = props.get("hubspot_owner_id")

            if not (dealstage and closedate and amount and owner_id):
                continue

            if dealstage != CLOSED_WON_STAGE:
                continue

            try:
                closed_dt = date_parser.parse(closedate)
                if closed_dt.year != current_year or closed_dt.month != current_month:
                    continue
                amount = float(amount)
            except Exception as e:
                print("❌ Error parsing date/amount:", e)
                continue

            owner_full_name = get_owner_name(owner_id)

            if owner_full_name not in ALLOWED_NAMES:
                continue

            short_name = ALLOWED_NAMES[owner_full_name]
            sales_by_owner[short_name] = sales_by_owner.get(short_name, 0) + amount

        paging = deals_data.get("paging")
        if paging and 'next' in paging:
            params["after"] = paging["next"]["after"]
        else:
            break

    result = [{"Name": name, "Sales": total} for name, total in sales_by_owner.items()]
    result.sort(key=lambda x: x["Sales"], reverse=True)

    
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)
