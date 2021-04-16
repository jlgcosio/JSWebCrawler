const { ipcRenderer } = require("electron");
const pup = require("puppeteer");
const Store = require("electron-store");

var cancelledOperation = false;
var store = new Store();

function toggleCancel() {
	cancelledOperation = !cancelledOperation;
	var cancelButton = document.getElementById("cancelButton");
	if (cancelledOperation) {
		cancelButton.innerHTML = "Cancelling operation...";
		console.log("Cancelling");
	} else {
		cancelButton.innerHTML = "Cancel";
	}
	return;
}

function toggleCancelButtonVisibility() {
	var cancelButton = document.getElementById("cancelButton");
	cancelButton.hidden = !cancelButton.hidden;
}

function getUrlInput() {
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

		// Add non-compliant url if not already in storage
		var storedReport = store.get("currentAvailableReport");
		if (storedReport === undefined) {
			var initializeReportList = [href];
			store.set("currentAvailableReport", initializeReportList);
		} else {
			if (!storedReport.includes(href)) {
				storedReport.push(href);
				store.set("currentAvailableReport", storedReport);
				console.log(`URLdded to Report: ${href}`);
			}
		}
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
	infoSuccess.textContent =
		"Operation complete. Check the Reports tab for a full list of links filtered by your selected Keywords or phrases.";

	infoPanel.appendChild(infoSuccess);

	/**
	 * Dynamic change of 'mailto' link on email input
	 */
	document
		.getElementById("emailInputField")
		.addEventListener("change", (evnt) => {
			var email = document.getElementById("emailInputField").value;
			document
				.getElementById("submitEmailButton")
				.setAttribute(
					"href",
					generateReportEmail(
						email,
						store.get("currentAvailableReport")
					)
				);
		});
}

function showInfo(url) {
	var infoSection = document.getElementById("infoSection");

	var infoPanel = document.createElement("div");
	infoPanel.setAttribute("class", "alert alert-primary");
	infoPanel.setAttribute("id", "infoPanel");
	infoPanel.setAttribute("role", "alert");

	var infoPanelHeader = document.createElement("h4");
	infoPanelHeader.setAttribute("class", "alert-header");
	infoPanelHeader.textContent = `Crawling through website: ${url}`;

	var line = document.createElement("hr");

	var infoTotalCount = document.createElement("p");
	infoTotalCount.innerHTML =
		'Total links gathered: <span id="totalLinks" class="badge badge-primary badge-pill">0</span>';

	infoPanel.appendChild(infoPanelHeader);
	infoPanel.appendChild(line);
	infoPanel.appendChild(infoTotalCount);

	infoSection.appendChild(infoPanel);
}

function fillReportList(links = []) {
	var reportList = document.getElementById("reportList");
	reportList.innerHTML = "";

	links.forEach((link) => {
		var item = document.createElement("li");
		item.setAttribute("class", "list-group-item");
		item.innerText = link;

		reportList.appendChild(item);
	});
}

async function initiate() {
	// Clear current list
	clearInfo();
	store.delete("currentAvailableReport"); // Clear out the stored list

	var url = getUrlInput();

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
	var filterInput = document.getElementById("filterInput").value.split("\n");

	// Set domain and initial search target;
	var baseUrl = new URL(url);
	baseUrl = baseUrl.href;

	sitemap.push(baseUrl);
	toggleCancelButtonVisibility();

	// Check valid links and visit all
	const extractAllLinks = async (u) => {
		if (currPageInSiteMap == sitemap.length) {
			console.log("Reached end of sitemap");
			return;
		} else if (cancelledOperation) {
			toggleCancel();
			toggleCancelButtonVisibility();
			return;
		} else {
			const tab = await browser.newPage();
			console.log("Opening: ", u);
			await tab.goto(u, { waitUntil: "load", timeout: 0 });
			await tab.waitForTimeout(5000);

			const currentPage = await tab.url();

			const getLinks = await tab.evaluate(
				(base, filterInput) => {
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

					var documentBody = document.body.innerHTML;
					var complianceCount = 0;

					var nonCompliantURL = "";
					filterInput.forEach((item) => {
						if (documentBody.toLowerCase().indexOf(item) != -1) {
							complianceCount++;
							nonCompliantURL = base;
						}
					});
					// Add to gui list
					return { pageHrefs, complianceCount, nonCompliantURL };
				},
				currentPage,
				filterInput
			);

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

			tab.close();
			await extractAllLinks(sitemap[currPageInSiteMap]);
		}
	};

	// Call for actual crawling
	await extractAllLinks(baseUrl);
	// Close browser instance
	await browser.close();

	// Fill out non-compliant list
	if (store.get("currentAvailableReport") !== undefined) {
		fillReportList(store.get("currentAvailableReport"));
	}

	toggleInfoComplete();
	ipcRenderer.sendSync(
		"console-display",
		store.get("currentAvailableReport")
	);
}

function generateReportEmail(email = "", bodyContent = [""]) {
	const newLine = "%0A";
	var body = bodyContent.join(newLine);

	return `mailto:${email}?body=${body}`;
}
