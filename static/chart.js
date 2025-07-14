const svg = d3.select("#chart"),
  width = +svg.attr("width"),
  height = +svg.attr("height"),
  margin = { top: 30, right: 80, bottom: 30, left: 100 };

const chartWidth = width - margin.left - margin.right;
const chartHeight = height - margin.top - margin.bottom;

const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleLinear().range([0, chartWidth]);
const y = d3.scaleBand().range([0, chartHeight]).padding(0.3);

const nicknames = {
  bela: "Bella (المشطشط🌶)",
  radwa: "Radwa (رظروظة)",
  sohaila: "Sohaila",
  noha: "Noha",
};

let lastTopSeller = "";
let isVideoPlaying = false;
let pollingInterval = null;

function updateChart(data) {
  x.domain([0, d3.max(data, d => d.Sales)]);
  y.domain(data.map(d => d.Name));

  const bars = g.selectAll("rect").data(data, d => d.Name);

  bars.exit().transition().duration(800).attr("width", 0).style("opacity", 0).remove();

  bars.transition().duration(2000)
    .attr("y", d => y(d.Name))
    .attr("width", d => x(d.Sales))
    .attr("height", y.bandwidth())
    .attr("fill", "#ff9933")
    .attr("rx", 8);

  bars.enter().append("rect")
    .attr("x", 0)
    .attr("y", d => y(d.Name))
    .attr("height", y.bandwidth())
    .attr("width", 0)
    .attr("fill", "#ff9933")
    .attr("rx", 8)
    .transition().duration(2000)
    .attr("width", d => x(d.Sales));

  const labels = g.selectAll(".label").data(data, d => d.Name);

  labels.exit().transition().duration(800).style("opacity", 0).remove();

  labels.transition().duration(2000)
    .attr("x", d => {
      const offset = x(d.Sales) + 15;
      return offset > chartWidth - 100 ? x(d.Sales) - 100 : offset;
    })
    .attr("y", d => y(d.Name) + y.bandwidth() / 2 + 5)
    .text(d => `EGP ${d.Sales.toLocaleString()}`)
    .attr("fill", "#ffffff")
    .attr("font-size", "22px")
    .attr("font-weight", "900");

  labels.enter().append("text")
    .attr("class", "label")
    .attr("x", d => x(d.Sales) + 15)
    .attr("y", d => y(d.Name) + y.bandwidth() / 2 + 5)
    .text(d => `EGP ${d.Sales.toLocaleString()}`)
    .attr("fill", "#ffffff")
    .attr("font-size", "22px")
    .attr("font-weight", "900")
    .style("opacity", 0)
    .transition().duration(2000)
    .style("opacity", 1);

  g.selectAll(".y-axis").remove();
  g.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(y).tickSize(0))
    .call(g => g.select(".domain").remove())
    .selectAll("text")
    .attr("fill", "#ffffff")
    .attr("font-size", "20px")
    .attr("font-weight", "bold")
    .style("text-anchor", "end")
    .attr("dx", "-0.8em");
}

async function fetchAndUpdate() {
  if (isVideoPlaying) return;

  try {
    const res = await fetch("/data");
    const json = await res.json();

    if (!Array.isArray(json) || json.length === 0 || !json[0]) return;

    const topSeller = json[0];
    if (topSeller.Name !== lastTopSeller) {
      lastTopSeller = topSeller.Name;
      isVideoPlaying = true;
      clearInterval(pollingInterval);
      await showVideoThenUpdate(topSeller, json);

      setTimeout(() => {
        isVideoPlaying = false;
        pollingInterval = setInterval(fetchAndUpdate, 10000);
      }, 10000);
    } else {
      updateChart(json);
      updateTopSellerUI(topSeller);
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

function updateTopSellerUI(topSeller) {
  const nameToShow = nicknames[topSeller.Name] || topSeller.Name;
  document.querySelector(".top-performer-name").textContent = nameToShow;
  document.getElementById("topImage").src = `/static/images/${topSeller.Name.toLowerCase()}.png`;
}

function showVideoThenUpdate(topSeller, fullData) {
  return new Promise((resolve) => {
    const videoPopup = document.getElementById("videoPopup");
    const video = document.getElementById("topVideo");

    video.src = `/static/videos/${topSeller.Name.toLowerCase()}.mp4`;
    video.muted = false;
    video.volume = 1.0;
    videoPopup.classList.remove("hidden");

    video.onended = cleanup;
    video.onerror = cleanup;

    function cleanup() {
      video.pause();
      videoPopup.classList.add("hidden");
      updateChart(fullData);
      updateTopSellerUI(topSeller);
      resolve();
    }

    video.play();
  });
}

fetchAndUpdate();
pollingInterval = setInterval(fetchAndUpdate, 10000);