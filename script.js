// script.js — Full file (copy/paste)

/*
  Replace API_KEY with your WeatherAPI key:
  const API_KEY = "YOUR_WEATHERAPI_KEY";
*/
const API_KEY = "472768be62034c28b2d153416251212"; // <-- put your key here

// short helpers
const $ = sel => document.querySelector(sel);
const safeIcon = u => !u ? "" : (u.startsWith("//") ? "https:" + u : u);
let chart = null;

/* ---------------- UI helpers ---------------- */
function showLoader(on){
  const l = $("#loader");
  if(l) l.style.display = on ? "block" : "none";
  if(on && $("#error")) $("#error").style.display = "none";
}
function showError(msg){
  const e = $("#error");
  if(e){
    e.style.display = "block";
    e.textContent = msg;
    if($("#loader")) $("#loader").style.display = "none";
  } else {
    console.error(msg);
  }
}

/* ---------------- Fetch & map WeatherAPI response ---------------- */
async function fetchWeather(city){
  if(!API_KEY || API_KEY === "YOUR_WEATHERAPI_KEY"){
    throw new Error("Missing API_KEY — paste your WeatherAPI key into script.js");
  }

  // WeatherAPI free: forecast.json with days=3
  const url = `https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(API_KEY)}&q=${encodeURIComponent(city)}&days=3&aqi=no&alerts=no`;
  const res = await fetch(url);
  const txt = await res.text();
  let json;
  try { json = JSON.parse(txt); } catch(e) { throw new Error("Invalid API response"); }

  if(res.status !== 200){
    const msg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const current = json.current;
  const today = json.forecast?.forecastday?.[0] || {};
  const hourly = (today.hour || []).map(h => ({
    time: h.time.split(" ")[1] || h.time,
    temp_c: h.temp_c, temp_f: h.temp_f,
    icon: h.condition.icon, text: h.condition.text
  }));

  const week = (json.forecast?.forecastday || []).map(d => ({
    date: d.date,
    day: new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }),
    text: d.day.condition.text,
    icon: d.day.condition.icon,
    max_c: d.day.maxtemp_c, min_c: d.day.mintemp_c,
    max_f: d.day.maxtemp_f, min_f: d.day.mintemp_f
  }));

  return {
    location: `${json.location.name}${json.location.region ? ', ' + json.location.region : ''}`,
    localtime: json.location.localtime,
    current: {
      temp_c: current.temp_c, temp_f: current.temp_f,
      feels_c: current.feelslike_c, feels_f: current.feelslike_f,
      condition: { text: current.condition.text, icon: current.condition.icon }
    },
    chance_of_rain: today?.day?.daily_chance_of_rain ?? 0,
    hourly,
    week,
    stats: {
      uv: current.uv ?? null,
      wind_kph: current.wind_kph ?? null,
      humidity: current.humidity ?? null,
      vis_km: current.vis_km ?? null,
      sunrise: today?.astro?.sunrise ?? null,
      sunset: today?.astro?.sunset ?? null
    }
  };
}

/* ---------------- Pad function to ensure 7 slots ---------------- */
function padWeek(week){
  // week: array of days returned by API (length 0..3 for free plan)
  const out = (week || []).slice(); // copy
  if(out.length >= 7) return out.slice(0,7);

  // if no days at all, create 7 placeholders
  if(out.length === 0){
    for(let i=0;i<7;i++){
      const d = new Date();
      d.setDate(d.getDate()+i);
      out.push({
        date: d.toISOString().slice(0,10),
        day: d.toLocaleDateString(undefined, { weekday: 'short' }),
        text: 'N/A',
        icon: '',
        max_c: 0, min_c: 0, max_f: 0, min_f: 0
      });
    }
    return out;
  }

  // Use last real day as seed for synthetic days
  const last = out[out.length-1];
  const lastDate = new Date(last.date);

  while(out.length < 7){
    const i = out.length - (week.length); // 0 for first synthetic day
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + (i + 1));

    // Slightly vary temps to look natural
    const baseMaxC = (last.max_c !== undefined ? last.max_c : (last.max || 20));
    const baseMinC = (last.min_c !== undefined ? last.min_c : (last.min || 10));
    const max_c = Math.round(baseMaxC + (i+1) * 0.8);
    const min_c = Math.round(baseMinC + (i+1) * 0.3);
    const max_f = Math.round(max_c * 9/5 + 32);
    const min_f = Math.round(min_c * 9/5 + 32);

    out.push({
      date: nextDate.toISOString().slice(0,10),
      day: nextDate.toLocaleDateString(undefined, { weekday: 'short' }),
      text: (last.text || 'Forecast (est.)'),
      icon: last.icon || '',
      max_c, min_c, max_f, min_f
    });
  }

  return out.slice(0,7);
}

/* ---------------- Render functions ---------------- */
function renderCurrent(m, unit){
  $("#location").textContent = m.location;
  $("#localtime").textContent = m.localtime;
  const t = unit === "C" ? m.current.temp_c : m.current.temp_f;
  $("#temp").innerHTML = `${Math.round(t)}<span class="deg">°</span>`;
  $("#feels").textContent = Math.round(unit==="C" ? m.current.feels_c : m.current.feels_f) + "°";
  $("#chance").textContent = m.chance_of_rain + "%";
  $("#condition").textContent = m.current.condition.text || "";
  const wrap = $("#iconWrap");
  if(wrap){
    const url = safeIcon(m.current.condition.icon);
    wrap.innerHTML = url ? `<img src="${url}" alt="icon">` : "";
  }
}

function renderHourly(m, unit){
  const cont = $("#hourlyList");
  if(!cont) return;
  cont.innerHTML = "";
  (m.hourly || []).slice(0,24).forEach(h => {
    const item = document.createElement("div");
    item.className = "hourly-item";
    const icon = safeIcon(h.icon);
    const temp = Math.round(unit==="C"?h.temp_c:h.temp_f);
    item.innerHTML = `<div class="time">${h.time}</div><div>${ icon ? `<img src="${icon}" alt="${h.text}">` : '' }</div><div class="temp">${temp}°</div>`;
    cont.appendChild(item);
  });
}

function renderForecast(m, unit){
  const ul = $("#forecastList");
  if(!ul) return;
  ul.innerHTML = "";

  // pad to 7 slots
  const padded = padWeek(m.week || []);

  // heading note
  const heading = $("#forecastHeading");
  const avail = (m.week || []).length;
  if(heading) heading.textContent = `7-Day Forecast (API returned ${avail} day${avail===1?'':'s'})`;

  padded.forEach((d, idx) => {
    const isPlaceholder = idx >= avail; // mark synthetic days
    const li = document.createElement("li");
    li.className = "forecast-item";
    if(isPlaceholder) li.style.opacity = "0.92";

    const iconUrl = safeIcon(d.icon || "");
    const max = Math.round(unit === "C" ? d.max_c : d.max_f);
    const min = Math.round(unit === "C" ? d.min_c : d.min_f);

    li.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        ${ iconUrl ? `<img src="${iconUrl}" width="34" alt="${d.text}">` : `<div style="width:34px;height:34px;border-radius:6px;background:rgba(0,0,0,0.03)"></div>` }
        <div>
          <div style="font-weight:700">${d.day}${isPlaceholder ? ' • est.' : ''}</div>
          <div class="muted small">${d.text}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700">${max}°</div>
        <div class="muted small">${min}°</div>
      </div>
    `;
    ul.appendChild(li);
  });
}

function renderStats(m){
  $("#uv").textContent = m.stats.uv ?? "—";
  $("#wind").textContent = (m.stats.wind_kph ?? "—") + (m.stats.wind_kph ? " kph" : "");
  $("#humidity").textContent = (m.stats.humidity ?? "—") + (m.stats.humidity ? "%" : "");
}

/* ---------------- Chart (uses padded 7 days) ---------------- */
function drawChart(m, unit){
  const canvas = document.getElementById("weatherChart");
  if(!canvas) return;
  const week7 = padWeek(m.week || []);
  const labels = week7.map(w => w.day);
  const highs = week7.map(w => Math.round(unit === "C" ? w.max_c : w.max_f));
  const lows  = week7.map(w => Math.round(unit === "C" ? w.min_c : w.min_f));

  if(chart) chart.destroy();
  chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'High', data: highs, borderColor: '#ff8c2d', backgroundColor: 'rgba(255,140,45,0.08)', tension: 0.3, pointRadius:4 },
        { label: 'Low',  data: lows,  borderColor: '#2b9cff', backgroundColor: 'rgba(43,156,255,0.06)', tension: 0.3, pointRadius:4 }
      ]
    },
    options: {
      plugins: { legend: { display: false }},
      scales: { y: { display: true, ticks: { color: '#556' } }, x: { ticks: { color: '#556' } } },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

/* ---------------- Load flow ---------------- */
async function loadCity(city, unit="C"){
  try{
    showLoader(true);
    const model = await fetchWeather(city);
    renderCurrent(model, unit);
    renderHourly(model, unit);
    renderForecast(model, unit);
    renderStats(model);
    drawChart(model, unit);
    showLoader(false);
    if($("#error")) $("#error").style.display = "none";
    localStorage.setItem("lastCity", city);
  } catch(err){
    showError(err.message || String(err));
  }
}

/* ---------------- Init DOM interactions ---------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  const input = $("#searchInput"), btn = $("#searchBtn"), unitBtn = $("#unitBtn");
  const leftBtn = document.getElementById("hourLeft"), rightBtn = document.getElementById("hourRight");
  const hourList = document.getElementById("hourlyList");

  let unit = localStorage.getItem("unit") || "C";
  if(unitBtn) unitBtn.textContent = unit === "C" ? "°C" : "°F";

  const last = localStorage.getItem("lastCity") || "Bhopal";
  if(input) input.value = last;

  loadCity(last, unit);

  if(btn && input){
    btn.addEventListener("click", ()=>{ const q = input.value.trim(); if(!q) return alert("Type a city"); loadCity(q, unit); });
    input.addEventListener("keydown", e => { if(e.key === "Enter") btn.click(); });
  }

  if(unitBtn){
    unitBtn.addEventListener("click", ()=>{
      unit = unit === "C" ? "F" : "C";
      localStorage.setItem("unit", unit);
      unitBtn.textContent = unit === "C" ? "°C" : "°F";
      const lastCity = localStorage.getItem("lastCity") || input.value;
      if(lastCity) loadCity(lastCity, unit);
    });
  }

  // hourly scroll arrows
  const scrollAmount = 220;
  if(leftBtn && hourList){
    leftBtn.addEventListener("click", ()=> hourList.scrollBy({ left: -scrollAmount, behavior: "smooth" }));
  }
  if(rightBtn && hourList){
    rightBtn.addEventListener("click", ()=> hourList.scrollBy({ left: scrollAmount, behavior: "smooth" }));
  }
});
