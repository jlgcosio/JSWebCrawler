const { ipcRenderer } = require("electron");
const pup = require("puppeteer");

async function initiate(url) {
	// Launch Browser in non-visual mode
	const browser = await pup.launch({
		headless: true,
	});
	console.log("Launched Browser");
	// Rewrite url to proper format for browsing
	if (!url.includes("http")) {
		url = "https://" + url;
	}
	// Instatiate Arrays
	var sitemap = [];
	var visited = [];
	var currPageInSiteMap = 0;
	var baseUrl = new URL(url);
	baseUrl = baseUrl.href;

	sitemap.push(baseUrl);

	// Check valid links and visit all
	const extractAllLinks = async (u) => {
		console.log("Checking: ", u);
		if (visited.includes(u)) {
			return;
		} else {
			console.log("Creating new page");
			const tab = await browser.newPage();
			console.log("Opening: ", u);
			await tab.goto(u, { waitUntil: "load", timeout: 0 });
			await tab.waitForTimeout(2000);

			visited.push(u);

			const getLinks = await tab.evaluate((base) => {
				var links = document.querySelectorAll("a");
				var pageHrefs = [];
				links.forEach((link) => {
					const ripped = link.getAttribute("href");
					var nonRelativeUrl = new URL(ripped, base).href;
					if (nonRelativeUrl.includes(new URL(base).hostname)) {
						pageHrefs.push(nonRelativeUrl);
					}
				});
				return pageHrefs;
			}, baseUrl);

			getLinks.forEach((link) => {
				sitemap.push(link);
			});
			ipcRenderer.sendSync("new-link-visited", u);
			currPageInSiteMap++;
			tab.close();
			await extractAllLinks(sitemap[currPageInSiteMap]);
		}
	};

	// Call for actual crawling
	console.log(`Extracting all links of ${baseUrl}`);
	await extractAllLinks(baseUrl);

	// Close browser instance
	await browser.close();
}

module.exports = { initiate };
