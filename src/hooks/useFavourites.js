import { useEffect, useState } from 'react'

const KEY = 'weather-favourites'

function readFavourites() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')) } catch { return new Set() }
}

// Persisted set of favourite city names. Tomorrow.io is only fetched for these.
export function useFavourites() {
  const [favourites, setFavourites] = useState(readFavourites)

  const toggleFavourite = (city) => {
    setFavourites((prev) => {
      const next = new Set(prev)
      next.has(city) ? next.delete(city) : next.add(city)
      return next
    })
  }

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify([...favourites])) } catch { /* ignore */ }
  }, [favourites])

  return { favourites, toggleFavourite }
}
