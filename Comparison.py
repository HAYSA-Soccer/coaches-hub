import os
import re
from datetime import datetime
import pandas as pd
from io import StringIO

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# ============================================================
# CONFIG
# ============================================================

MASTER_CONFIG_PATH = r"G:\My Drive\HAYSA\WebMaster Files\HAYSA_Master_Config.xlsx"
BASE_DIR = r"C:\Users\dbm19\OneDrive\Documents\HAYSA"

def detect_season_label():
    now = datetime.now()
    year = now.year
    month = now.month
    if month in (3, 4, 5, 6):
        return f"Spring {year}"
    elif month in (8, 9, 10, 11):
        return f"Fall {year}"
    return f"{year}"

SEASON_LABEL = detect_season_label()
OUTPUT_XLSX = os.path.join(BASE_DIR, f"SSSL_vs_TS_Comparison_{SEASON_LABEL}.xlsx")

if " " in SEASON_LABEL:
    SEASON_YEAR = int(SEASON_LABEL.split()[-1])
else:
    SEASON_YEAR = datetime.now().year




def load_sssl_contest_metadata():
    df = pd.read_excel(MASTER_CONFIG_PATH, sheet_name="SSSL Contest List")

    # Normalize column names: strip spaces, lowercase, remove punctuation
    df.columns = (
        df.columns
        .str.strip()
        .str.lower()
        .str.replace(r"[^\w\s]", "", regex=True)  # remove punctuation like periods
    )

    # After normalization, your columns become:
    # 'contest id', 'team name optional', 'notes optional'

    id_col = "contest id"
    team_col = "team name optional"
    notes_col = "notes optional"

    meta = {}
    for _, row in df.iterrows():
        cid = str(row[id_col]).strip()
        meta[cid] = {
            "team": str(row.get(team_col, "")).strip(),
            "division": str(row.get(notes_col, "")).strip()
        }
    return meta



# ============================================================
# HELPERS
# ============================================================

def normalize_location(raw_loc):
    if not isinstance(raw_loc, str):
        return ""
    raw_loc = raw_loc.strip()
    if " / " in raw_loc:
        return raw_loc.split(" / ", 1)[1].strip()
    return raw_loc

def extract_town_abbr(team_name):
    if not isinstance(team_name, str) or not team_name.strip():
        return ""
    return team_name.split(" ", 1)[0].strip()

def load_location_mapping():
    loc_df = pd.read_excel(MASTER_CONFIG_PATH, sheet_name="Location Mapping")
    field_map = dict(zip(loc_df["SSSL Field Name"], loc_df["TS Field Code"]))

    town_map = {}
    for _, row in loc_df.iterrows():
        town = str(row["Town Name"]).strip()
        abbr = str(row["Town Abbreviation"]).strip()
        alias = str(row.get("Town Abbreviation Alias", "")).strip()
        if abbr:
            town_map[abbr.upper()] = town
        if alias:
            town_map[alias.upper()] = town

    return loc_df, field_map, town_map

def load_sssl_contest_list():
    df = pd.read_excel(MASTER_CONFIG_PATH, sheet_name="SSSL Contest List")
    links = []
    for _, row in df.iterrows():
        url = str(row.get("Contest URL", "")).strip()
        cid_raw = row.get("Contest ID", "")
        cid = ""
        if pd.notna(cid_raw):
            cid = str(cid_raw).strip()
            if cid.endswith(".0"):
                cid = cid[:-2]
        if url:
            links.append(url)
        elif cid:
            links.append(f"https://sssl.sportspilot.com/Scheduler/public/report.aspx?contest={cid}&header=on")
    return links

# ============================================================
# HAYSA DETECTION
# ============================================================

def is_haysa_team_sssl(name):
    if not isinstance(name, str):
        return False
    town = name.split(" ", 1)[0].upper()
    return town in ["HOLA", "HAYSA", "H-"]

# ⭐ FINAL BULLETPROOF TRAVEL VS REC FILTER
def is_haysa_team_ts(name):
    if not isinstance(name, str):
        return False

    s = name.strip().lower()

    # Must contain grade band
    has_grade = bool(re.search(r"\b(\d+/\d+|grade\s*\d+/\d+|pg|u\d+)\b", s))

    # Must contain gender
    has_gender = any(g in s for g in ["boys", "girls", "coed"])

    # Must contain coach parentheses
    has_coach = "(" in s and ")" in s

    # TRAVEL = all three present
    return has_grade and has_gender and has_coach

# ============================================================
# DATE/TIME
# ============================================================

def parse_datetime(date_str, time_str):
    if not isinstance(date_str, str) or not isinstance(time_str, str):
        return pd.NaT
    d = date_str.strip()
    if len(d) > 3 and d[:3].isalpha():
        parts = d.split(" ", 1)
        if len(parts) == 2:
            d = parts[1]
    if d.count("/") == 1:
        d = f"{d}/{SEASON_YEAR}"
    try:
        return datetime.strptime(f"{d} {time_str}", "%m/%d/%Y %I:%M %p")
    except:
        return pd.NaT

# ============================================================
# GAME LENGTHS / END TIME
# ============================================================

def compute_end_time(start_dt, division):
    if pd.isna(start_dt):
        return pd.NaT

    div = str(division).lower()

    if "3/4" in div:
        total_minutes = 55
    elif "5/6" in div:
        total_minutes = 65
    elif "7/8" in div:
        total_minutes = 75
    else:
        total_minutes = 85

    return start_dt + pd.Timedelta(minutes=total_minutes)

# ============================================================
# DIVISION + COACH NORMALIZATION
# ============================================================

def extract_coach(name):
    if not isinstance(name, str):
        return ""
    m = re.search(r"\(([^)]+)\)", name)
    if m:
        return m.group(1).strip()
    return ""

def normalize_ts_division(div_text):
    if not isinstance(div_text, str):
        return ""
    s = div_text.lower()
    if "3/4" in s and "girl" in s:
        return "3/4 Girls"
    if "3/4" in s and "boy" in s:
        return "3/4 Boys"
    if "5/6" in s and "girl" in s:
        return "5/6 Girls"
    if "5/6" in s and "boy" in s:
        return "5/6 Boys"
    if "7/8" in s and "girl" in s:
        return "7/8 Girls"
    if "7/8" in s and "boy" in s:
        return "7/8 Boys"
    return div_text.strip()

def normalize_sssl_division(team_name):
    if not isinstance(team_name, str):
        return ""
    parts = team_name.split()
    if len(parts) < 2:
        return ""
    code = parts[1].upper()
    if code.startswith("G4"):
        return "3/4 Girls"
    if code.startswith("B4"):
        return "3/4 Boys"
    if code.startswith("G6"):
        return "5/6 Girls"
    if code.startswith("B6"):
        return "5/6 Boys"
    if code.startswith("G8"):
        return "7/8 Girls"
    if code.startswith("B8"):
        return "7/8 Boys"
    return ""

def build_normalized_team_ts(row):
    div = normalize_ts_division(row.get("Division", ""))
    coach = extract_coach(row.get("HAYSA Team", ""))
    return f"{div} - {coach}".strip()

def build_normalized_team_sssl(row):
    div = normalize_sssl_division(row.get("HAYSA Team", ""))
    coach = extract_coach(row.get("HAYSA Team", ""))
    return f"{div} - {coach}".strip()

def identify_hola_team(df):
    teams = pd.concat([df["Visitor"], df["Home"]]).dropna().unique()
    for t in teams:
        if "HOLA" in t.upper():
            return t.strip()
    return "No HOLA Team Found"

# ============================================================
# OPPONENT TOWN
# ============================================================

def opponent_town_ts(row):
    home = row.get("Home", "")
    away = row.get("Away", "")
    h_haysa = is_haysa_team_ts(home)
    a_haysa = is_haysa_team_ts(away)
    if h_haysa and not a_haysa:
        return away.strip()
    if a_haysa and not h_haysa:
        return home.strip()
    return ""

def opponent_town_sssl(row, town_map):
    v = row.get("Visitor", "")
    h = row.get("Home", "")
    v_is = is_haysa_team_sssl(v)
    h_is = is_haysa_team_sssl(h)
    if v_is and not h_is:
        opp_abbr = extract_town_abbr(h).upper()
    elif h_is and not v_is:
        opp_abbr = extract_town_abbr(v).upper()
    else:
        opp_abbr = ""
    if opp_abbr and opp_abbr in town_map:
        return town_map[opp_abbr]
    return ""

# ============================================================
# TS SCRAPER
# ============================================================

def setup_ts_driver():
    opts = webdriver.ChromeOptions()
    opts.add_argument("--headless=new")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1920,3000")
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=opts)

def get_ts_schedule_links(driver):
    driver.get("https://www.haysa.org/schedules")
    WebDriverWait(driver, 15).until(
        EC.presence_of_all_elements_located((By.XPATH, '//*[@id="SchedulesPageLayout"]//a'))
    )
    links = driver.find_elements(By.XPATH, '//*[@id="SchedulesPageLayout"]//a')
    out = []
    for link in links:
        href = link.get_attribute("href")
        txt = link.text.strip()
        if href and "/schedule/" in href.lower():
            out.append({"url": href, "division": txt})
    return out

def extract_ts_schedule_table(driver):
    table = WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.XPATH, "//table[contains(@id,'ScheduleGrid')]"))
    )

    html = driver.execute_script("return arguments[0].outerHTML;", table)
    df = pd.read_html(StringIO(html))[0]

    # ⭐ TS tables usually include: Date, Time, Home, Away, Location, Score
    # If the score column exists, keep it. If not, create an empty one.
    if df.shape[1] >= 6:
        df.columns = ["Date", "Time", "Home", "Away", "Location", "Score_TS"]
    else:
        df.columns = ["Date", "Time", "Home", "Away", "Location"]
        df["Score_TS"] = ""

    return df





def clean_ts_schedule_df(df, division):
    df = df.copy()
    valid = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    df = df[df["Date"].astype(str).str[:3].isin(valid)]

    def strip_num(x):
        x = str(x).strip()
        m = re.search(r"(\d+)$", x)
        if m:
            return x[:x.rfind(m.group())].strip(), int(m.group())
        return x.strip(), None

    df["H"] = df["Home"].apply(lambda x: strip_num(x)[1])
    df["Home"] = df["Home"].apply(lambda x: strip_num(x)[0])
    df["A"] = df["Away"].apply(lambda x: strip_num(x)[1])
    df["Away"] = df["Away"].apply(lambda x: strip_num(x)[0])
    df["Division"] = division
    return df

def identify_haysa_team_ts(row):
    h = is_haysa_team_ts(row["Home"])
    a = is_haysa_team_ts(row["Away"])
    if h and not a:
        return row["Home"]
    if a and not h:
        return row["Away"]
    if h and a:
        return row["Home"]
    return None

def run_ts_scrape():
    driver = setup_ts_driver()
    try:
        links = get_ts_schedule_links(driver)
        frames = []
        for info in links:
            driver.get(info["url"])
            df = extract_ts_schedule_table(driver)
            df = clean_ts_schedule_df(df, info["division"])
            if not df.empty:
                frames.append(df)

        if not frames:
            return pd.DataFrame()

        # ⭐ Remove empty AND all‑NA DataFrames to silence FutureWarning
        frames = [df for df in frames if not df.empty and not df.isna().all().all()]

        ts = pd.concat(frames, ignore_index=True)

        ts["HAYSA Team"] = ts.apply(identify_haysa_team_ts, axis=1)
        ts = ts[ts["HAYSA Team"].notna()].copy()
        ts["DateTime"] = ts.apply(lambda r: parse_datetime(r["Date"], r["Time"]), axis=1)
        ts["TS Field Code"] = ts["Location"].astype(str).str.strip()
        ts["OpponentTown"] = ts.apply(opponent_town_ts, axis=1)
        ts["NormalizedTeam"] = ts.apply(build_normalized_team_ts, axis=1)
        return ts
    finally:
        try:
            driver.quit()
        except:
            pass


def run_ts_scrape_all():
    driver = setup_ts_driver()
    try:
        links = get_ts_schedule_links(driver)
        frames = []
        for info in links:
            driver.get(info["url"])
            df = extract_ts_schedule_table(driver)
            df = clean_ts_schedule_df(df, info["division"])
            if not df.empty:
                frames.append(df)

        if not frames:
            return pd.DataFrame()

        frames = [df for df in frames if not df.empty and not df.isna().all().all()]
        ts = pd.concat(frames, ignore_index=True)

        # No HAYSA filtering
        ts["DateTime"] = ts.apply(lambda r: parse_datetime(r["Date"], r["Time"]), axis=1)
        ts["TS Field Code"] = ts["Location"].astype(str).str.strip()

        # Keep raw Home/Away scores extracted earlier
        ts["Score_TS"] = ts["Score_TS"].astype(str)

        return ts
    finally:
        try:
            driver.quit()
        except:
            pass





def compare_ts_sssl(ts, sssl):
    today = pd.Timestamp.today().normalize()

    # Normalize keys for matching
    ts_key = ts["NormalizedTeam"] + "|" + ts["DateTime"].astype(str)
    sssl_key = sssl["NormalizedTeam"] + "|" + sssl["DateTime"].astype(str)

    ts["Key"] = ts_key
    sssl["Key"] = sssl_key

    # --- Missing TS scores ---
    missing_ts_scores = ts[
        (ts["Score"].isna() | (ts["Score"] == "")) &
        (ts["DateTime"] <= today)
    ]

    # --- Missing SSSL scores ---
    missing_sssl_scores = sssl[
        (sssl["Score"].isna() | (sssl["Score"] == "")) &
        (sssl["DateTime"] <= today)
    ]

    # --- TS game missing in SSSL ---
    missing_in_sssl = ts[~ts["Key"].isin(sssl["Key"])]

    # --- SSSL game missing in TS ---
    missing_in_ts = sssl[~sssl["Key"].isin(ts["Key"])]

    # --- Score mismatches ---
    merged = ts.merge(
        sssl[["Key", "Score"]],
        on="Key",
        how="inner",
        suffixes=("_TS", "_SSSL")
    )

    score_mismatches = merged[
        (merged["Score_TS"] != merged["Score_SSSL"]) &
        (merged["DateTime"] <= today)
    ]

    return {
        "missing_ts_scores": missing_ts_scores,
        "missing_sssl_scores": missing_sssl_scores,
        "missing_in_sssl": missing_in_sssl,
        "missing_in_ts": missing_in_ts,
        "score_mismatches": score_mismatches
    }


# ============================================================
# SSSL SCRAPER
# ============================================================

HEADERS = ["Event ID", "Date", "Time", "End", "Location", "Visitor", "V", "Home", "H"]

def clean_location(loc):
    if not isinstance(loc, str):
        return ""
    if "/" in loc:
        return loc.split("/", 1)[1].strip()
    return loc.strip()

def scrape_contest(page, url):
    try:
        page.goto(url + "&print=1", wait_until="load", timeout=60000)
    except PlaywrightTimeoutError:
        print("Timeout:", url)
        return pd.DataFrame(columns=HEADERS)

    html = page.content()

    rows = []

    # Find all <tr> blocks
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", html, flags=re.DOTALL):

        # Extract all <td> cells
        cells = re.findall(r"<td[^>]*>(.*?)</td>", tr, flags=re.DOTALL)
        if not cells:
            continue

        # Clean HTML tags
        cleaned = [re.sub(r"<.*?>", "", c).strip() for c in cells]

        # Must have at least 10 cells (group col + 9 data cols)
        if len(cleaned) < 10:
            continue

        # Event ID is cleaned[1]
        if cleaned[1].isdigit():

            # Extract the 9 standard columns
            mapped = cleaned[1:10]

            # ⭐ ADD SCORE EXTRACTION
            visitor_score = cleaned[6]   # V column
            home_score = cleaned[8]      # H column

            # Append both scores to the row
            mapped.append(visitor_score)
            mapped.append(home_score)

            rows.append(mapped)

    # ⭐ Updated HEADERS must include score columns
    extended_headers = HEADERS + ["Score_V", "Score_H"]

    return pd.DataFrame(rows, columns=extended_headers)


def run_sssl_scrape(field_map, town_map):
    links = load_sssl_contest_list()   # still returns a list of URLs
    print("SSSL contests:", len(links))

    # ⭐ Load contest metadata from Excel
    contest_df = pd.read_excel(MASTER_CONFIG_PATH, sheet_name="SSSL Contest List")

    # ⭐ Normalize column names: strip spaces, lowercase, remove punctuation
    contest_df.columns = (
        contest_df.columns
        .str.strip()
        .str.lower()
        .str.replace(r"[^\w\s]", "", regex=True)  # remove punctuation like periods
    )

    # After normalization, your columns become:
    # 'contest id', 'team name optional', 'notes optional'

    id_col = "contest id"
    team_col = "team name optional"
    notes_col = "notes optional"

    # ⭐ Build metadata dictionary
    contest_meta = {
        str(row[id_col]).strip(): {
            "team": str(row.get(team_col, "")).strip(),
            "division": str(row.get(notes_col, "")).strip()
        }
        for _, row in contest_df.iterrows()
    }


    frames = []

    def identify_hola_team(df):
        if df.empty:
            return ""
        teams = pd.concat([df["Visitor"], df["Home"]]).dropna().unique()
        for t in teams:
            if "HOLA" in t.upper():
                return t.strip()
        return ""

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        for url in links:
            # Extract contest ID from URL
            cid = url.split("contest=")[1].split("&")[0]

            # ⭐ Lookup division + team name from Excel
            division = contest_meta.get(cid, {}).get("division", "Unknown Division")
            config_team = contest_meta.get(cid, {}).get("team", "")

            # Scrape
            df = scrape_contest(page, url)
            hola_team = identify_hola_team(df)

            # ⭐ Enhanced header using Excel data
            print(f"\nScraping {division} ({config_team})")
            print(url)
            print(f" -> {len(df)} games")

            if not df.empty:
                frames.append(df)

        browser.close()

    if not frames:
        return pd.DataFrame()

    # ⭐ Your existing logic continues unchanged
    sssl = pd.concat(frames, ignore_index=True)
    sssl.drop_duplicates(subset=["Event ID"], inplace=True)

    def tag_haysa(row):
        v = row["Visitor"]
        h = row["Home"]
        v_is = is_haysa_team_sssl(v)
        h_is = is_haysa_team_sssl(h)
        if v_is and not h_is:
            return {"HAYSA Game": "Yes", "HAYSA Team": v}
        if h_is and not v_is:
            return {"HAYSA Game": "Yes", "HAYSA Team": h}
        if v_is and h_is:
            return {"HAYSA Game": "Yes", "HAYSA Team": v}
        return {"HAYSA Game": "No", "HAYSA Team": ""}

    tagged = sssl.apply(tag_haysa, axis=1)
    sssl = pd.concat([sssl, tagged.apply(pd.Series)], axis=1)

    sssl["SSSL Field Name"] = sssl["Location"].apply(clean_location)
    sssl["TS Field Code"] = sssl["SSSL Field Name"].map(field_map)
    sssl["TS Field Code"] = sssl["TS Field Code"].astype(str).str.strip()

    sssl["DateTime"] = sssl.apply(lambda r: parse_datetime(r["Date"], r["Time"]), axis=1)
    sssl["OpponentTown"] = sssl.apply(lambda r: opponent_town_sssl(r, town_map), axis=1)
    sssl["NormalizedTeam"] = sssl.apply(build_normalized_team_sssl, axis=1)

    sssl = sssl.sort_values("DateTime").reset_index(drop=True)
    return sssl
# ============================================================
# NORMALIZATION
# ============================================================

def normalize_ts(ts):
    df = ts.copy()
    df["Source"] = "TS"

    df["Opponent"] = df.apply(
        lambda r: r["Away"] if r["HAYSA Team"] == r["Home"] else r["Home"],
        axis=1
    )

    df["EndTime"] = df.apply(
        lambda r: compute_end_time(r["DateTime"], r["Division"]),
        axis=1
    )

    return df[[
        "Date", "Time", "DateTime", "EndTime",
        "TS Field Code",
        "Home", "Away",
        "HAYSA Team", "Opponent",
        "OpponentTown",
        "NormalizedTeam",
        "Division", "Score_TS", "Source"
    ]]

def normalize_sssl(sssl):
    df = sssl.copy()

    # Only keep games where we've already tagged a HAYSA travel team
    df = df[df["HAYSA Game"] == "Yes"].copy()

    df["Source"] = "SSSL"

    # Opponent: if HAYSA is home, opponent is visitor; otherwise opponent is home
    df["Opponent"] = df.apply(
        lambda r: r["Visitor"] if r["HAYSA Team"] == r["Home"] else r["Home"],
        axis=1
    )

    # ⭐ Combine visitor/home scores into one score string
    df["Score_SSSL"] = df.apply(
        lambda r: f"{r['Score_V']}-{r['Score_H']}" if (str(r["Score_V"]).isdigit() and str(r["Score_H"]).isdigit()) else "",
        axis=1
    )

    # End time based on normalized division (e.g., "3/4 Boys", "5/6 Girls")
    df["EndTime"] = df.apply(
        lambda r: compute_end_time(r["DateTime"], r["NormalizedTeam"]),
        axis=1
    )

    # Return normalized SSSL view (⭐ now includes Score_SSSL)
    return df[[
        "Event ID",
        "Date", "Time", "DateTime", "EndTime",
        "TS Field Code",
        "Visitor", "Home",
        "HAYSA Team", "Opponent",
        "OpponentTown",
        "NormalizedTeam",
        "Score_SSSL",   # ⭐ NEW
        "Source"
    ]]




# ============================================================
# COMPARISON
# ============================================================

def compare_schedules(ts_norm, sssl_norm):
    merged = pd.merge(
        ts_norm,
        sssl_norm,
        how="outer",
        left_on=["DateTime", "NormalizedTeam", "OpponentTown"],
        right_on=["DateTime", "NormalizedTeam", "OpponentTown"],
        suffixes=("_TS", "_SSSL"),
        indicator=True
    )

    # Clean object columns
    for col in merged.columns:
        if merged[col].dtype == "object":
            merged[col] = merged[col].astype(str).str.strip()

    # Missing flags
    merged["MissingInTS"] = merged["_merge"] == "right_only"
    merged["MissingInSSSL"] = merged["_merge"] == "left_only"

    # Mismatch flags
    merged["DateMismatch"] = False
    merged["TimeMismatch"] = False
    merged["FieldMismatch"] = False
    merged["OpponentMismatch"] = False

    both = merged["_merge"] == "both"

    # Date/time mismatches (placeholder — always False)
    merged.loc[both, "DateMismatch"] = (
        merged.loc[both, "DateTime"].dt.date
        != merged.loc[both, "DateTime"].dt.date
    )

    merged.loc[both, "TimeMismatch"] = (
        merged.loc[both, "DateTime"].dt.time
        != merged.loc[both, "DateTime"].dt.time
    )

    # Field mismatch
    merged.loc[both, "FieldMismatch"] = (
        merged.loc[both, "TS Field Code_TS"].str.upper()
        != merged.loc[both, "TS Field Code_SSSL"].str.upper()
    )

    # Opponent mismatch placeholder
    merged.loc[both, "OpponentMismatch"] = False

    # ============================================================
    # ATTENTION LOGIC
    # ============================================================

    def attention_reason(row):
        if row["MissingInTS"] and row["MissingInSSSL"]:
            return "🔄 Replace TS game with SSSL game — remove TS version, add SSSL version"

        if row["MissingInTS"]:
            return "➕ Add to TS — SSSL has this game but TS does not"

        if row["MissingInSSSL"]:
            return "➖ Remove from TS — TS has a game SSSL does not"

        fixes = []
        if row["DateMismatch"]:
            fixes.append("Date mismatch")
        if row["TimeMismatch"]:
            fixes.append("Time mismatch")
        if row["FieldMismatch"]:
            fixes.append("Field mismatch")
        if row["OpponentMismatch"]:
            fixes.append("Opponent mismatch")

        if fixes:
            return "⚠ Needs correction: " + ", ".join(fixes)

        return ""

    merged["AttentionNeeded"] = merged.apply(attention_reason, axis=1)

    return merged

# ============================================================
# MAIN
# ============================================================

def main():
    print(f"=== Running Master Schedule Validator ({SEASON_LABEL}) ===")

    # Load mapping sheets
    loc_df, field_map, town_map = load_location_mapping()

    # ============================================================
    # TRAVEL PIPELINE (unchanged)
    # ============================================================

    # Scrape TS (travel-only because of HAYSA filter)
    ts_raw = run_ts_scrape()
    print("TS TRAVEL games scraped:", len(ts_raw))

    # Scrape SSSL (travel-only)
    sssl_raw = run_sssl_scrape(field_map, town_map)
    print("SSSL games scraped:", len(sssl_raw))

    if ts_raw.empty or sssl_raw.empty:
        print("One source returned no data. Aborting.")
        return

    # Normalize travel TS + SSSL
    ts_norm = normalize_ts(ts_raw)
    sssl_norm = normalize_sssl(sssl_raw)

    print("TS normalized:", len(ts_norm))
    print("SSSL normalized:", len(sssl_norm))

    print("TS Norm Columns:", ts_norm.columns.tolist())
    print("SSSL Norm Columns:", sssl_norm.columns.tolist())

    # ============================================================
    # TRAVEL COMPARISON (unchanged)
    # ============================================================

    today = pd.Timestamp.today().normalize()

    ts_norm["Key"] = ts_norm["NormalizedTeam"] + "|" + ts_norm["DateTime"].astype(str)
    sssl_norm["Key"] = sssl_norm["NormalizedTeam"] + "|" + sssl_norm["DateTime"].astype(str)

    missing_ts_scores = ts_norm[
        ((ts_norm["Score_TS"].isna()) | (ts_norm["Score_TS"] == "")) &
        (ts_norm["DateTime"] <= today)
    ]

    missing_sssl_scores = sssl_norm[
        ((sssl_norm["Score_SSSL"].isna()) | (sssl_norm["Score_SSSL"] == "")) &
        (sssl_norm["DateTime"] <= today)
    ]

    missing_in_sssl = ts_norm[~ts_norm["Key"].isin(sssl_norm["Key"])]
    missing_in_ts = sssl_norm[~sssl_norm["Key"].isin(ts_norm["Key"])]

    merged_scores = ts_norm.merge(
        sssl_norm[["Key", "Score_SSSL"]],
        on="Key",
        how="inner"
    )

    score_mismatches = merged_scores[
        (merged_scores["Score_TS"] != merged_scores["Score_SSSL"]) &
        (merged_scores["DateTime"] <= today)
    ]

    print("\n=== Score & Game Presence Check ===")
    print("Missing TS scores:", len(missing_ts_scores))
    print("Missing SSSL scores:", len(missing_sssl_scores))
    print("TS games missing in SSSL:", len(missing_in_sssl))
    print("SSSL games missing in TS:", len(missing_in_ts))
    print("Score mismatches:", len(score_mismatches))
    print("=== End Score Check ===\n")

    # Past TS + SSSL views (travel only)
    past_ts = ts_norm[ts_norm["DateTime"] <= today].copy().sort_values("DateTime")
    past_sssl = sssl_norm[sssl_norm["DateTime"] <= today].copy().sort_values("DateTime")

    print("\n=== Past TS Games & Scores ===")
    print(past_ts[["NormalizedTeam", "DateTime", "Home", "Away", "Score_TS"]])

    print("\n=== Past SSSL Games & Scores ===")
    print(past_sssl[["NormalizedTeam", "DateTime", "Home", "Visitor", "Score_SSSL"]])

    score_compare = ts_norm.merge(
        sssl_norm[["Key", "Score_SSSL"]],
        on="Key",
        how="left"
    )

    past_score_compare = score_compare[
        score_compare["DateTime"] <= today
    ].copy().sort_values("DateTime")

    print("\n=== Past TS vs SSSL Score Comparison ===")
    print(past_score_compare[["NormalizedTeam", "DateTime", "Score_TS", "Score_SSSL"]])

    mismatch = compare_schedules(ts_norm, sssl_norm)

    ts_cols = [c for c in mismatch.columns if c.endswith("_TS")]
    mismatch[ts_cols] = mismatch[ts_cols].replace("nan", "").fillna("—")

    complex_df = pd.read_excel(MASTER_CONFIG_PATH, sheet_name="Field Complex Mapping")
    canonical_map = dict(zip(complex_df["abbreviation"], complex_df["canonical_field"]))

    def canonical_complex(field_code):
        field_code = str(field_code).strip()
        return canonical_map.get(field_code, field_code)

    issues = mismatch[mismatch["AttentionNeeded"] != ""].copy()

    def fmt_dt(dt):
        return dt.strftime("%a %m/%d at %#I:%M %p")

    def is_haysa_home_ts(row):
        return str(row.get("Home_TS", "")).strip() == str(row.get("HAYSA Team_TS", "")).strip()

    def is_haysa_home_sssl(row):
        return str(row.get("Home_SSSL", "")).strip() == str(row.get("HAYSA Team_SSSL", "")).strip()

    if issues.empty:
        print("\n=== No Issues Found === \n The Team Sideline / HAYSA.org Site FULLY MATCHES the South Shore Soccer League.")
    else:
        print("\n=== Issues Detected ===")
        # (unchanged issue printing)
        print("\n=== End of Issues ===\n")

    # ============================================================
    # PARALLEL TS PIPELINE (NEW)
    # ============================================================

    print("\n=== Running TS ALL-GAMES scrape ===")
    ts_all_raw = run_ts_scrape_all()   # <-- NEW FUNCTION
    print("TS ALL games scraped:", len(ts_all_raw))

    # ============================================================
    # Save Excel
    # ============================================================

    with pd.ExcelWriter(OUTPUT_XLSX) as writer:
        ts_raw.to_excel(writer, sheet_name="TS Raw", index=False)
        sssl_raw.to_excel(writer, sheet_name="SSSL Raw", index=False)
        ts_norm.to_excel(writer, sheet_name="TS Normalized", index=False)
        sssl_norm.to_excel(writer, sheet_name="SSSL Normalized", index=False)
        mismatch.to_excel(writer, sheet_name="Mismatch Report", index=False)
        past_ts.to_excel(writer, sheet_name="TS Past Scores", index=False)
        past_sssl.to_excel(writer, sheet_name="SSSL Past Scores", index=False)
        past_score_compare.to_excel(writer, sheet_name="Past Score Compare", index=False)

        # ⭐ NEW SHEET: TS All Games (travel + rec + clinic + in-town)
        ts_all_raw.to_excel(writer, sheet_name="TS All Games", index=False)

    print("\n=== File Updated === \n Saved:", OUTPUT_XLSX)
    print("\n=== Refresh Fully Completed ===")

# ============================================================
# EXECUTION GUARD
# ============================================================

if __name__ == "__main__":
    main()







