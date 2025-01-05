const { chromium } = require('playwright');
const axios = require('axios');

let answerCount = 1;

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  const nameSelector = 'button#name-container span';
  const textBoxSelector = '.connect-text-area'; // Contenteditable div for the answer

  // Navigate to the login page
  await page.goto('https://www.quill.org/session/new');
  console.log('Navigated to the site. Please log in.');

  // Enable copy-paste permissions
  await page.evaluate(() => {
    document.oncopy = null;
    document.oncut = null;
    document.onpaste = null;

    const style = document.createElement('style');
    style.innerHTML = `
      * {
        user-select: auto !important;
        -webkit-user-select: auto !important;
        -ms-user-select: auto !important;
        pointer-events: auto !important;
      }
    `;
    document.head.appendChild(style);

    console.log('Copy-paste permissions enabled.');
  });

  // Wait for user to log in
  await page.waitForSelector(nameSelector);
  const name = await page.locator(nameSelector).nth(0).textContent();
  console.log(`Login successful! Welcome, ${name.trim()}!\n`);

  // Listen for HTTP responses to process answers
  page.on('response', async (response) => {
    if (response.url().includes('responses')) {
      try {
        const data = await axios.get(response.url());
        for (const answerBlob in data.data) {
          if (data.data[answerBlob].optimal) {
            const answer = data.data[answerBlob].text;
            console.log(`Answer ${answerCount}: ${answer}`);

            // Input the answer into the contenteditable div
            await page.evaluate(({ selector, answer }) => {
              const textBox = document.querySelector(selector);
              if (textBox) {
                textBox.textContent = answer; // Set the answer
                const event = new Event('input', { bubbles: true }); // Trigger input event
                textBox.dispatchEvent(event);
              } else {
                console.error('Text box not found!');
              }
            }, { selector: textBoxSelector, answer }); // Pass arguments as an object

            // Simulate pressing Enter (if required)
            await page.keyboard.press('Enter');

            answerCount += 1;
          }
        }
      } catch (error) {
        console.log('Error fetching response:', error);
      }
    }
  });

  // Keep the script running for interaction
  console.log('Waiting for network activity...');
  await page.waitForTimeout(60000); // Keeps the browser open for testing
})();
