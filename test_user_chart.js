const { generateChartUrls } = require('./src/features/mood-tracker/chart');
const { request } = require('undici');

console.log('--- Testing Real User Chart Generation ---');

const userId = '860909419226595328';
const timezone = 'Asia/Jakarta';

generateChartUrls(userId, 'cchwy', timezone, 7)
  .then(async urls => {
    console.log('Generated Sleep URL:', urls.sleepChartUrl);
    console.log('Generated Caffeine URL:', urls.caffeineChartUrl);

    // Fetch Sleep URL image
    console.log('Fetching Sleep Chart Image...');
    const sleepRes = await request(urls.sleepChartUrl);
    console.log('Sleep HTTP Status Code:', sleepRes.statusCode);
    if (sleepRes.statusCode !== 200) {
      const body = await sleepRes.body.text();
      console.error('Sleep error body:', body);
    }

    // Fetch Caffeine URL image
    console.log('Fetching Caffeine Chart Image...');
    const caffRes = await request(urls.caffeineChartUrl);
    console.log('Caffeine HTTP Status Code:', caffRes.statusCode);
    if (caffRes.statusCode !== 200) {
      const body = await caffRes.body.text();
      console.error('Caffeine error body:', body);
    }

    if (sleepRes.statusCode === 200 && caffRes.statusCode === 200) {
      console.log('✅ Success! QuickChart returned status 200 for user charts.');
    } else {
      console.error('❌ Failed!');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ URL generation failed:', err);
    process.exit(1);
  });
