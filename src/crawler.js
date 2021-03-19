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
		url = "http://" + url;
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
			try {
				console.log("Creating new page");
				const tab = await browser.newPage();
				console.log("Opening: ", u);
				await tab.goto(u);
				await tab.waitForTimeout(1000);

				visited.push(u);

				const getLinks = await tab.evaluate(() => {
					var links = document.querySelectorAll("a");
					links.forEach((link) => {
						const ripped = link.getAttribute("href");
						var nonRelativeUrl = new URL(ripped, baseUrl).href;
						if (nonRelativeUrl.includes(baseUrl)) {
							sitemap.push(nonRelativeUrl);
						}
					});
					ipcRenderer.send("new-link-visited", u);
                    return links;
				});
                console.log(getLinks);
				currPageInSiteMap++;
				tab.close();
				extractAllLinks(sitemap[currPageInSiteMap]);
			} catch (error) {
				console.log(error);
			}
		}
	};

	// Call for actual crawling
	console.log(`Extracting all links of ${baseUrl}`);
	await extractAllLinks(baseUrl);

	// Close browser instance
	await browser.close();
}

module.exports = { initiate };
