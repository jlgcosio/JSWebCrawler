const { ipcRenderer } = require("electron");
const pup = require("puppeteer");

function getUrl() {
	var urlBox = document.getElementById("urlInput");
	return urlBox.value;
}

function addToList(href, compliant = true, filterCount = 0) {
	var list = document.getElementById("linkList");
	var item = document.createElement("li");
	if (!compliant) {
		item.setAttribute("class", "list-group-item list-group-item-danger");
		var filterBadge = document.createElement("span");
		filterBadge.setAttribute("class", "badge badge-primary badge-pill");
		filterBadge.innerHTML = filterCount;

		item.appendChild(filterBadge);
	} else {
		item.setAttribute("class", "list-group-item");
	}
	item.innerText = href;

	list.appendChild(item);
}

function clearInfo() {
	var list = document.getElementById("linkList");
	list.innerHTML = "";

	var infoSection = document.getElementById("infoSection");
	infoSection.innerHTML = "";

	var totalVisitedCounter = document.getElementById("linksVisited");
	totalVisitedCounter.innerHTML = "";
}

function updateTotalLinks(total) {
	var totalLinksCounter = document.getElementById("totalLinks");
	totalLinksCounter.innerHTML = total;
}

function updateTotalVisited(number) {
	var totalVisitedCounter = document.getElementById("linksVisited");
	totalVisitedCounter.innerHTML = number;
}

function toggleInfoComplete() {
	var infoPanel = document.getElementById("infoPanel");
	infoPanel.setAttribute("class", "alert alert-success");

	var infoSuccess = document.createElement("p");
	infoPanel.textContent = "Complete";

	var line = document.createElement("hr");

	infoPanel.appendChild(line);
	infoPanel.appendChild(infoSuccess);
}

function showInfo(url) {
	var infoSection = document.getElementById("infoSection");

	var infoPanel = document.createElement("div");
	infoPanel.setAttribute("class", "alert alert-primary");
	infoPanel.setAttribute("id", "infoPanel");
	infoPanel.setAttribute("role", "alert");

	var infoPanelHeader = document.createElement("h4");
	infoPanelHeader.setAttribute("class", "alert-header");
	infoPanelHeader.textContent = `Crawling through webiste: ${url}`;

	var line = document.createElement("hr");

	var infoTotalCount = document.createElement("p");
	infoTotalCount.innerHTML =
		'Total links gathered: <span id="totalLinks" class="badge badge-primary badge-pill">0</span>';

	infoPanel.appendChild(infoPanelHeader);
	infoPanel.appendChild(line);
	infoPanel.appendChild(infoTotalCount);

	infoSection.appendChild(infoPanel);
}

async function initiate() {
	// Clear current list
	clearInfo();

	var url = getUrl();

	// Launch Browser in non-visual mode
	const browser = await pup.launch({
		headless: true,
	});
	console.log("Launched Browser");

	// Rewrite url to proper format for browsing
	if (!url.includes("http")) {
		url = "https://" + url;
	}
	showInfo(url);

	// Instatiate Arrays
	var sitemap = [];
	var currPageInSiteMap = 0;
    var filterInput = document
					.getElementById("filterInput")
					.value.split("\n");

	// Set domain and initial search target;
	var baseUrl = new URL(url);
	baseUrl = baseUrl.href;

	sitemap.push(baseUrl);

	// Check valid links and visit all
	const extractAllLinks = async (u) => {
		if (currPageInSiteMap == sitemap.length) {
			console.log("Reached end of sitemap");
			return;
		} else {
			const tab = await browser.newPage();
			console.log("Opening: ", u);
			await tab.goto(u, { waitUntil: "load", timeout: 0 });
			await tab.waitForTimeout(5000);

			const currentPage = await tab.url();

			const getLinks = await tab.evaluate((base, filterInput) => {
				var links = document.querySelectorAll("a");
				var pageHrefs = [];
				links.forEach((link) => {
					const ripped = link.getAttribute("href");
					var nonRelativeUrl = new URL(ripped, base).href;
					if (
						nonRelativeUrl.includes(new URL(base).hostname) &&
						!nonRelativeUrl.includes("#") &&
						!nonRelativeUrl.includes("null")
					) {
						pageHrefs.push(nonRelativeUrl);
					}
				});

                var content = document.body.innerHTML;
                var complianceCount = 0;
				filterInput.forEach((item) => {
					if (content.toLowerCase().indexOf(item) != -1) {
						complianceCount++;
					}
				});
				// Add to gui list
				return {pageHrefs, complianceCount};
			}, currentPage, filterInput);

			addToList(u, getLinks.complianceCount > 0 ? false : true);
			// Double check if items in current evaluation are already in sitemap
			getLinks.pageHrefs.forEach((link) => {
				if (!sitemap.includes(link)) {
					sitemap.push(link);
				}
			});
			// Move to next item in sitemap
			currPageInSiteMap++;
			updateTotalLinks(sitemap.length);
			updateTotalVisited(currPageInSiteMap);
			complianceCount = 0;
			tab.close();
			await extractAllLinks(sitemap[currPageInSiteMap]);
		}
	};

	// Call for actual crawling
	await extractAllLinks(baseUrl);
	// Close browser instance
	await browser.close();

	toggleInfoComplete();
	ipcRenderer.sendSync("console-display", sitemap);
}
