const { ipcRenderer } = require("electron");
const pup = require("puppeteer");

function getUrl(){
    var urlBox = document.getElementById('urlInput');
    return urlBox.value;
}

function addToList(href){
    var list = document.getElementById('linkList');
    var item = document.createElement('li');
    item.setAttribute('class', 'list-group-item');
    item.innerHTML = href;

    list.appendChild(item);
}

ipcRenderer.on('update-visited-links', (event, arg) => {
    if(arg){
        console.log("NOT EMPTY LIST");
    }
});

async function initiate() {
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
	// Instatiate Arrays
	var sitemap = [];
	var visited = [];
	var currPageInSiteMap = 0;
	var baseUrl = new URL(url);
	baseUrl = baseUrl.href;

	sitemap.push(baseUrl);

	// Check valid links and visit all
	const extractAllLinks = async (u) => {
		if (visited.includes(u)) {
			return;
		} else {
			const tab = await browser.newPage();
			console.log("Opening: ", u);
			await tab.goto(u, { waitUntil: "load", timeout: 0 });
			await tab.waitForTimeout(3000);

            const currentPage = await tab.url();

			const getLinks = await tab.evaluate((base) => {
				var links = document.querySelectorAll("a");
                console.log(links);
				var pageHrefs = [];
				links.forEach((link) => {
					const ripped = link.getAttribute("href");
					var nonRelativeUrl = new URL(ripped, base).href;
					if (nonRelativeUrl.includes(new URL(base).hostname) && (!nonRelativeUrl.includes('#') || !nonRelativeUrl.includes('null'))) {
						pageHrefs.push(nonRelativeUrl);
					}
				});
				return pageHrefs;
			}, currentPage);

            visited.push(currentPage);
            addToList(currentPage);

			getLinks.forEach((link) => {
                if (!sitemap.includes(link)) {
                    sitemap.push(link);
                }
			});
			++currPageInSiteMap;
			tab.close();
            console.log(currPageInSiteMap);
			await extractAllLinks(sitemap[currPageInSiteMap]);
		}
	};

	// Call for actual crawling
	console.log(`Extracting all links of ${baseUrl}`);
	await extractAllLinks(baseUrl);
    console.log("Extraction End");
	// Close browser instance
	await browser.close();

    ipcRenderer.sendSync('console-display', sitemap);
}
