const puppeteer = require('puppeteer')
const { Cluster } = require('puppeteer-cluster')

const { makeScreenshot } = require('./screenshot.js')

const DEFAULT_CLUSTER_MAX_CONCURRENCY = 2;

module.exports = async function(options) {
  const {
    html,
    content,
    output,
    selector = 'body',
    puppeteerArgs = {},
    clusterOptions = {},
    pageNavigationTimeout,
  } = options

  if (!html) {
    throw Error('You must provide an html property.')
  }

  if (typeof clusterOptions.maxConcurrency !== 'number') {
    clusterOptions.maxConcurrency = DEFAULT_CLUSTER_MAX_CONCURRENCY;
  }

  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    puppeteerOptions: { ...puppeteerArgs, headless: true },
    ...clusterOptions,
  });

  const buffers = []

  await cluster.task(async ({ page, data: { content, output, selector } }) => {
    if (typeof pageNavigationTimeout === 'number') {
      await page.setDefaultNavigationTimeout(pageNavigationTimeout);
    }
    const buffer = await makeScreenshot(page, { ...options, content, output, selector })
    buffers.push(buffer);
  });

  cluster.on('taskerror', (err, data) => {
    throw err
  });

  const shouldBatch = Array.isArray(content)
  const contents = shouldBatch ? content : [{ ...content, output, selector }]

  contents.forEach(content => {
    const { output, selector: contentSelector, ...pageContent } = content
    cluster.queue({ output, content: pageContent, selector: contentSelector ? contentSelector : selector })
  })

  await cluster.idle();
  await cluster.close();

  return shouldBatch ? buffers : buffers[0]
 
}

