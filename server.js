const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const amazonHost = process.env.AMAZON_HOST || 'webservices.amazon.in';
const amazonRegion = process.env.AMAZON_REGION || 'us-east-1';
const partnerTag = process.env.AMAZON_PARTNER_TAG || 'dealshub0b6f-21';
const accessKey = process.env.AMAZON_ACCESS_KEY || '';
const secretKey = process.env.AMAZON_SECRET_KEY || '';

const fallbackProducts = [
  {
    id: 1,
    name: 'Wireless Bluetooth Headphones',
    brand: 'SoundCore',
    category: 'Electronics',
    description: 'Noise-cancelling wireless headphones with crisp audio, long battery life, and all-day comfort.',
    image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=900&q=80',
    price: 1899,
    mrp: 2999,
    rating: 4.4,
    reviews: 1240,
    badge: 'Best Seller',
    featured: true,
    specs: [
      { label: 'Battery', value: '30 hours' },
      { label: 'Connectivity', value: 'Bluetooth 5.3' },
      { label: 'Noise Cancellation', value: 'Active' },
      { label: 'Weight', value: '240g' }
    ],
    offers: [
      { store: 'Amazon', price: 1899, shipping: 'Free', stock: 'In stock', url: `https://www.amazon.in/s?k=wireless+headphones&tag=${partnerTag}` },
      { store: 'Flipkart', price: 1999, shipping: '₹49', stock: 'In stock', url: 'https://www.flipkart.com/search?q=wireless+headphones' }
    ]
  },
  {
    id: 2,
    name: 'Smartphone 5G 128GB',
    brand: 'Nova Mobile',
    category: 'Electronics',
    description: '5G-ready smartphone with AI camera, large battery, and smooth 120Hz display.',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
    price: 14999,
    mrp: 17999,
    rating: 4.3,
    reviews: 864,
    badge: 'Trending',
    featured: true,
    specs: [
      { label: 'Battery', value: '5000mAh' },
      { label: 'Storage', value: '128GB' },
      { label: 'Camera', value: '50MP AI' },
      { label: 'Connectivity', value: '5G' }
    ],
    offers: [
      { store: 'Amazon', price: 14999, shipping: 'Free', stock: 'In stock', url: `https://www.amazon.in/s?k=5g+smartphone+128gb&tag=${partnerTag}` },
      { store: 'Flipkart', price: 15499, shipping: '₹79', stock: 'In stock', url: 'https://www.flipkart.com/search?q=5g+smartphone+128gb' }
    ]
  }
];

function buildIsoDate() {
  return new Date().toISOString().replace(/[:-]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function signRequest(method, url, headers, payload, accessKeyId, secretAccessKey, region, service) {
  const now = new Date();
  const amzDate = buildIsoDate();
  const dateStamp = amzDate.slice(0, 8);
  const canonicalUri = new URL(url).pathname || '/';
  const canonicalQuery = new URL(url).searchParams.toString();
  const canonicalHeaders = Object.entries(headers)
    .map(([k, v]) => `${k.toLowerCase()}:${String(v).trim()}\n`)
    .sort()
    .join('');
  const signedHeaders = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort()
    .join(';');
  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  return {
    Authorization: `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'X-Amz-Date': amzDate
  };
}

function normalizeAmazonProduct(item) {
  const title = item?.ItemInfo?.Title?.DisplayValue || item?.ItemInfo?.Title?.StandardText || 'Amazon Product';
  const brand = item?.ItemInfo?.ByLineInfo?.Brand?.DisplayValue || item?.ItemInfo?.ByLineInfo?.Manufacturer?.DisplayValue || 'Amazon';
  const image = item?.Images?.Primary?.Large?.URL || item?.Images?.Primary?.Medium?.URL || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=900&q=80';
  const priceInfo = item?.Offers?.Listings?.[0]?.Price || item?.Offers?.Listings?.[0]?.BuyingPrice || null;
  const price = Number(priceInfo?.Amount || priceInfo?.DisplayAmount?.replace(/[^0-9.]/g, '') || 0);
  const mrp = Math.max(price, Math.round(price * 1.4));
  const features = item?.ItemInfo?.Features?.DisplayValues || [];
  const specs = features.slice(0, 4).map((feature, index) => ({
    label: index === 0 ? 'Highlights' : `Feature ${index + 1}`,
    value: feature
  }));

  return {
    id: item?.ASIN || `${Date.now()}-${Math.random()}`,
    name: title,
    brand,
    category: 'Electronics',
    description: features[0] || 'Amazon product detail',
    image,
    price: price || 1999,
    mrp: mrp || 2999,
    rating: 4.4,
    reviews: 1000,
    badge: 'Amazon Pick',
    featured: true,
    specs: specs.length ? specs : [
      { label: 'Category', value: 'Electronics' },
      { label: 'Availability', value: 'In stock' }
    ],
    offers: [
      { store: 'Amazon', price: price || 1999, shipping: 'Free', stock: 'In stock', url: `https://www.amazon.in/dp/${item?.ASIN || ''}?tag=${partnerTag}` }
    ]
  };
}

async function fetchFromAmazon(searchTerm) {
  if (!accessKey || !secretKey) {
    return [];
  }

  const endpoint = `https://${amazonHost}/paapi5/searchitems`;
  const payload = JSON.stringify({
    Keywords: searchTerm,
    SearchIndex: 'All',
    ItemCount: 10,
    PartnerTag: partnerTag,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.in',
    Resources: [
      'Images.Primary.Large',
      'ItemInfo.ByLineInfo',
      'ItemInfo.ContentInfo',
      'ItemInfo.Features',
      'ItemInfo.Title',
      'Offers.Listings.Price'
    ]
  });

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Encoding': 'amz-1.0',
    'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
    Host: amazonHost
  };

  const signedHeaders = signRequest('POST', endpoint, headers, payload, accessKey, secretKey, amazonRegion, 'paapi5');
  const response = await axios.post(endpoint, payload, {
    headers: {
      ...headers,
      ...signedHeaders
    },
    validateStatus: () => true
  });

  if (response.status >= 400) {
    return [];
  }

  const items = response.data?.SearchResult?.Items || [];
  return items.map(normalizeAmazonProduct);
}

app.get('/api/products', async (req, res) => {
  try {
    const searchTerm = (req.query.q || 'electronics').trim() || 'electronics';
    const products = await fetchFromAmazon(searchTerm);
    if (products && products.length) {
      return res.json({ source: 'amazon-api', products });
    }
    return res.json({ source: 'fallback', products: fallbackProducts });
  } catch (error) {
    res.json({ source: 'fallback', products: fallbackProducts, error: String(error.message || error) });
  }
});

app.use(express.static(path.join(__dirname)));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SmartDeals API server running at http://localhost:${PORT}`);
  console.log('Add AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, AMAZON_PARTNER_TAG to .env to enable live Amazon API products.');
});
