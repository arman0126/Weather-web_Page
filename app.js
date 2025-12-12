// ---------- PUT YOUR KEY HERE ----------
const API_KEY = "472768be62034c28b2d153416251212"; // <-- replace with your WeatherAPI key

// helpers
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
let chart;

// show/hide
function showLoader(on){
  $("#loader").style.display = on ? "block" : "none";
  $("#error").style.display = "none";
}
function showError(msg){
  $("#error").style.display = "block";
  $("#error").textContent = msg;
  $("#loader").style.display = "none";
}

// build safe icon url
function safeIcon(url){
  if(!url) return "";
  return url.startsWith("//") ? "https:" + url : url;
}

// map WeatherAPI response into UI model
function mapWeather(json){
  const current = json.current;
  const today = json.forecast.forecastday[0];

  const model = {
    location: `${json.location.name}${json.location.region ? ", " + json.location.region : ""}`,
    localtime: json.location.localtime,
    temp: current.temp_c,
    temp_f: current.temp_f,
    feels: current.feelslike_c,
    condition: current.condition.text,
    currentIconUrl: safeIcon(current.condition.icon),
    chance: today.day.daily_chance_of_rain || 0,
    hourly: today.hour.map(h => ({
      t: h.time.split(" ")[1],
      temp_c: h.temp_c,
      temp_f: h.temp_f,
      iconUrl: safeIcon(h.condition.icon),
      text: h.condition.text
    })),
    week: json.forecast.forecastday.map(d => ({
      date: d.date,
      day: new Date(d.date).toLocaleDateString(undefined,{weekday:"short"}),
      max_c: d.day.maxtemp_c,
      min_c: d.day.mintemp_c,
      iconUrl: safeIcon(d.day.condition.icon),
      text: d.day.condition.text
    })),
    uv: current.uv,
    wind_kph: current.wind_kph,
    humidity: current.humidity,
    vis_km: current.vis_km,
    sunrise: today.astro.sunrise,
    sunset: today.astro.sunset
  };
  return model;
}

// render functions
function renderCurrent(m, unit){
  $("#location").textContent = m.location;
  $("#localtime").textContent = m.localtime;
  $("#temp").innerHTML = `${Math.round(unit==="C"? m.temp : m.temp_f)}<span class="deg">°</span>`;
  $("#feels").textContent = `${Math.round(unit==="C"? m.feels : m.feels*9/5 + 32)}°`;
  $("#condition").textContent = m.condition;
  $("#chance").textContent = m.chance + "%";

  // icon
  const wrap = $("#iconWrap");
  wrap.innerHTML = "";
  if(m.currentIconUrl){
    const img = document.createElement("img");
    img.src = m.currentIconUrl;
    img.alt = m.condition;
    img.onload = ()=>{};
    wrap.appendChild(img);
  }
}

function renderHourly(m, unit){
  const cont = $("#hourly");
  cont.innerHTML = "";
  // show first 12 hours or available
  m.hourly.slice(0,12).forEach(h=>{
    const el = document.createElement("div");
    el.className = "hourly-chip";
    el.innerHTML = `
      <div class="time">${h.t}</div>
      <div class="ico">${ h.iconUrl ? `<img src="${h.iconUrl}" alt="${h.text}"/>` : `<span>—</span>` }</div>
      <div class="temp">${Math.round(unit==="C"? h.temp_c : h.temp_f)}°</div>
    `;
    cont.appendChild(el);
  });
}

function renderForecast(m, unit){
  const ul = $("#forecastList");
  ul.innerHTML = "";
  m.week.forEach(d=>{
    const li = document.createElement("li");
    li.className = "forecast-item";
    li.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center">
        ${ d.iconUrl ? `<img src="${d.iconUrl}" width="34" alt="${d.text}">` : `<span>—</span>` }
        <div>
          <div style="font-weight:700">${d.day}</div>
          <div style="color:var(--muted);font-size:13px">${d.text}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700">${Math.round(d.max_c)}°</div>
        <div style="color:var(--muted);font-size:13px">${Math.round(d.min_c)}°</div>
      </div>
    `;
    ul.appendChild(li);
  });
  // chart
  drawChart(m.week, unit);
}

function renderStats(m, unit){
  $("#uv").textContent = m.uv ?? "—";
  $("#wind").textContent = `${Math.round(m.wind_kph)} kph`;
  $("#humidity").textContent = `${m.humidity}%`;
  $("#visibility").textContent = `${m.vis_km} km`;
  $("#sunrise").textContent = m.sunrise;
  $("#sunset").textContent = m.sunset;
}

// chart
function drawChart(week, unit){
  const labels = week.map(w=>w.day);
  const highs = week.map(w=> unit==="C" ? w.max_c : Math.round(w.max_c*9/5+32));
  const lows = week.map(w=> unit==="C" ? w.min_c : Math.round(w.min_c*9/5+32));
  const ctx = document.getElementById("weeklyChart").getContext("2d");
  if(chart) chart.destroy();
  chart = new Chart(ctx,{
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'High', data: highs, borderColor: '#ff7a00', backgroundColor: 'rgba(255,122,0,0.08)', tension:0.35 },
        { label: 'Low', data: lows, borderColor: '#1f8ef1', backgroundColor: 'rgba(31,142,241,0.06)', tension:0.35 }
      ]
    },
    options: { responsive:true, plugins:{legend:{display:false}} , scales:{ y:{display:false} } }
  });
}

// main loader
async function loadCity(city, unit="C"){
  try{
    showLoader(true);
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(API_KEY)}&q=${encodeURIComponent(city)}&days=7&aqi=no&alerts=no`;
    const r = await fetch(url);
    const txt = await r.text();
    const json = JSON.parse(txt);
    if(r.status !== 200) {
      const msg = json?.error?.message || txt;
      throw new Error(msg);
    }
    const model = mapWeather(json);
    renderCurrent(model, unit);
    renderHourly(model, unit);
    renderForecast(model, unit);
    renderStats(model, unit);
    showLoader(false);
    $("#error").style.display = "none";
    localStorage.setItem("lastCity", city);
  } catch(err){
    console.error(err);
    showError(err.message || "Failed to load");
  }
}

// bootstrap UI
document.addEventListener("DOMContentLoaded", ()=>{
  const input = $("#searchInput");
  const btn = $("#searchBtn");
  const unitBtn = $("#unitBtn");

  const saved = localStorage.getItem("lastCity") || "New York";
  input.value = saved;

  let unit = localStorage.getItem("unit") || "C";
  unitBtn.textContent = unit === "C" ? "°C" : "°F";

  btn.addEventListener("click", ()=> {
    const q = input.value.trim();
    if(!q) return alert("Type a city");
    loadCity(q, unit);
  });
  input.addEventListener("keydown", (e)=> { if(e.key==="Enter") btn.click(); });

  unitBtn.addEventListener("click", ()=>{
    unit = unit === "C" ? "F" : "C";
    localStorage.setItem("unit", unit);
    unitBtn.textContent = unit === "C" ? "°C" : "°F";
    // re-run for last city to update units
    const last = localStorage.getItem("lastCity") || input.value;
    loadCity(last, unit);
  });

  // initial load
  loadCity(saved, unit);
});
