const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser on your desktop...');
  try {
    // Launch real Chrome browser in headed mode
    const browser = await chromium.launch({
      headless: false,
      channel: 'chrome'
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('Navigating to Lithic Job Application on Greenhouse...');
    await page.goto('https://job-boards.greenhouse.io/lithic/jobs/6007106004?utm_source=Simplify&gh_src=Simplify');
    
    // Wait for form to load
    await page.waitForSelector('#first_name');
    
    console.log('Filling out standard contact information...');
    await page.fill('#first_name', 'Stephen');
    await page.fill('#last_name', 'Skalamera');
    await page.fill('#email', 'skalamera@gmail.com');
    await page.fill('#phone', '(443) 624-1226');
    
    console.log('Uploading your 2026 PDF Resume...');
    const resumePath = 'C:\\Users\\skala\\OneDrive\\Documents\\Resumes\\Resume 2026-Skalamera.pdf';
    await page.setInputFiles('#resume', resumePath);
    
    console.log('Filling out custom questions...');
    
    // LinkedIn Profile
    await page.fill('#question_17918525004', 'https://www.linkedin.com/in/skalamera');
    
    // Website / Portfolio / Puzzle Repository
    // Let\'s put both your portfolio and the link to the decrypted puzzle repo!
    const portfolioUrl = 'https://skalamera.me | Solution Repo: https://github.com/skalamera/lithic-challenge';
    await page.fill('input[id*="17918526"]', portfolioUrl);
    
    // US Sponsorship (select "No")
    const sponsorshipSelect = await page.$('select[id*="17918527"]');
    if (sponsorshipSelect) {
      await sponsorshipSelect.selectOption({ label: 'No' });
    }
    
    // Relocation to NYC (select "Yes")
    const relocationSelect = await page.$('select[id*="17918529"]');
    if (relocationSelect) {
      await relocationSelect.selectOption({ label: 'Yes' });
    }
    
    // Salary Expectations
    await page.fill('#question_17918530004', '$180,000 - $210,000');
    
    // Complex Technical Challenges response
    const challengesText = "Based on my understanding of Lithic's architecture as an API-first card issuer, I believe the most complex challenges revolve around low-latency high-throughput authorization and real-time ledger consistency. Operating as a critical link between card networks (Visa/Mastercard) and developer APIs requires processing authorization decisions within milliseconds while managing active-active database states across multiple banking partners to prevent double-spending. Furthermore, maintaining flawless real-time transaction reconciliation, ensuring high-reliability webhook delivery to client servers during network partitions, and building robust, multi-tenant rate-limiting systems are massive engineering feats.";
    await page.fill('#question_17918531004', challengesText);
    
    // Answer to Cracked the Code question
    await page.fill('#question_17918533004', '42');
    
    console.log('---------------------------------------------------------');
    console.log('🎉 SUCCESS: Lithic application form is fully filled out!');
    console.log('---------------------------------------------------------');
    console.log('A Google Chrome window is now open on your desktop.');
    console.log('PLEASE REVIEW the fields carefully.');
    console.log('Do NOT close this terminal window yet -- keeping it open preserves the browser.');
    console.log('Once you are satisfied and ready, you can submit the form manually.');
    console.log('You can then close the browser window or terminate this script (Ctrl+C).');
    
    // Keep browser open
    await new Promise(() => {});
  } catch (error) {
    console.error('Error occurred:', error);
  }
})();
