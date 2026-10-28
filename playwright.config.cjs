const {defineConfig}=require('@playwright/test');
const port=process.env.SAG_TEST_PORT||'8766',baseURL='http://127.0.0.1:'+port;
module.exports=defineConfig({
  testDir:'tests',testMatch:'*.spec.cjs',timeout:120000,workers:1,
  use:{baseURL,viewport:{width:1200,height:1600},headless:true,
    launchOptions:{executablePath:process.env.SAG_TEST_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'}},
  webServer:{command:'python ai-service/app.py --port '+port,url:baseURL+'/health',reuseExistingServer:true,timeout:30000},
});
