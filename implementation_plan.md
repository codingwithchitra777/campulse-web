# Add Sparkline to CSX List using Redis

The goal is to store the last 60 days of closing prices for CSX stocks in Redis and display them as a sparkline in the CSX list. 

## User Review Required

### Open Questions

1. **Which specific CSX list?** The frontend has a few places where CSX stocks are listed: 
   - The **Watchlist** page (when the CSX market is selected)
   - The **Portfolio** holdings list
   - The **Dashboard** "Market Movers" (Top Winners/Losers) list
   Please let me know which of these lists (or all of them) should display the sparkline.
2. **30 vs 60 days:** Your request mentioned both "last 30 days" and "last 60 days". I will default to 60 days of 1-day interval closing prices based on your final sentence. Let me know if you prefer 30.

## Proposed Changes

### Backend (campulse-backend)

#### [MODIFY] pyproject.toml
- Add the edis dependency.

#### [NEW] app/services/redis_service.py
- Create a RedisService class that connects to your provided URI (edis://default:FIwEoRahdTexVeF2MlgQRyT2XjhwIUuJ@time-camera-show-26003.db.redis.io:11914).
- Implement methods to get and set sparkline data (using a Redis Hash HSET sparkline:{ticker} {date} {price}) and prune data older than 60 days.

#### [MODIFY] app/services/pricing.py
- In snapshot_prices(), after saving the price to the database, also update the Redis store for that ticker and date.
- Add a startup sync routine that queries the price_history table and backfills the last 60 days into Redis if Redis is empty.

#### [MODIFY] app/api/v1/endpoints/market.py
- Add a new endpoint GET /api/v1/market/sparklines that accepts a list of tickers (e.g. ?tickers=PWSA,GTI) and returns their 60-day price arrays directly from Redis.

### Frontend (campulse-web)

#### [NEW] src/app/components/sparkline/sparkline.ts & sparkline.html
- Create a lightweight pp-sparkline standalone component. Instead of heavy Chart.js instances for every row, this will render a clean, simple inline SVG path based on the array of historical prices. It will color the line green if the trend is up, or red if it's down.

#### [MODIFY] src/app/services/api.service.ts
- Add a method to fetch sparkline data from the new /api/v1/market/sparklines endpoint.

#### [MODIFY] (Target Frontend List Component - e.g. watchlist.html / dashboard.html)
- Integrate the pp-sparkline component into the table/list columns for CSX assets, fetching the data when the list loads.

## Verification Plan
1. Start the backend and verify that the startup routine successfully reads from the DB and writes the historical data to Redis.
2. Verify the new /api/v1/market/sparklines endpoint returns the expected 60-day arrays.
3. Serve the frontend and visually confirm that sparklines render correctly (green/red) in the target list(s).
