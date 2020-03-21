import React, { useState, useEffect, useRef } from "react"
import { Map, CircleMarker, Popup, TileLayer } from "react-leaflet"
import "./App.css"

const App = () => {
  const [stats, setStats] = useState(null)
  const [maxConfirmed, setMaxConfirmed] = useState(null)

  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState(null)
  const debouncedSearchTerm = useDebounce(searchTerm, 500)

  const mapRef = useRef(null)

  useEffect(() => {
    fetch(
      "https://api.github.com/repos/CSSEGISandData/COVID-19/contents/csse_covid_19_data/csse_covid_19_time_series?ref=master"
    )
      .then(res => res.json())
      .then(files => {
        files = files
          .filter(file => file.name.includes("csv"))
          .map(file => fetch(file.download_url))

        Promise.all(files)
          .then(async data => [
            await data[0].text(),
            await data[1].text(),
            await data[2].text()
          ])
          .then(data => {
            let types = ["confirmed", "deaths", "recovered"]
            let fetchedStats = {}

            data.forEach((d, i) => {
              d = d.split("\n")
              d.shift()
              d.forEach(stats => {
                stats = stats.split(/,+(?![^"]*")/g)

                let state = stats[0]

                if (stats[0].startsWith(',"')) {
                  state = ""
                  stats.unshift("")
                  stats[1] = stats[1].substring(1).replace(/"/g, "")
                }

                let country = stats[1]
                let lat = stats[2]
                let lng = stats[3]

                let data = stats.slice(4)
                data = data.map(stat => parseInt(stat))

                if (!fetchedStats.hasOwnProperty(state + country)) {
                  fetchedStats[state + country] = {
                    state,
                    country,
                    lat,
                    lng
                  }
                }

                fetchedStats[state + country][types[i]] = data
              })
            })

            fetchedStats = Object.values(fetchedStats)
              .filter(stat => getDataFromDaysAgo(stat, "confirmed") > 0)
              .sort(
                (x, y) =>
                  getDataFromDaysAgo(y, "confirmed") -
                  getDataFromDaysAgo(x, "confirmed")
              )

            setStats(fetchedStats)
            setMaxConfirmed(getDataFromDaysAgo(fetchedStats[0], "confirmed"))
          })
      })
  }, [])

  useEffect(() => {
    if (debouncedSearchTerm) {
      let results = stats
        .filter(
          stat =>
            stat.state
              .split(",")
              .some(keyword =>
                debouncedSearchTerm
                  .toLowerCase()
                  .includes(keyword.toLowerCase())
              ) ||
            stat.country
              .split(",")
              .some(keyword =>
                debouncedSearchTerm
                  .toLowerCase()
                  .includes(keyword.toLowerCase())
              )
        )
        .slice(0, 6)
      setSearchResults(results)
    } else {
      setSearchResults(null)
    }
  }, [debouncedSearchTerm])

  const numberWithCommas = x =>
    x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")

  const getDataFromDaysAgo = (stat, type, daysAgo = 0) =>
    stat[type][stat[type].length - 1 - daysAgo]

  return (
    <div className="wrapper">
      <Map
        center={[30.7378, 112.2384]}
        minZoom={2}
        maxZoom={10}
        maxBounds={[
          [-90, -180],
          [90, 180]
        ]}
        ref={mapRef}
        style={{ flex: 1 }}
        zoom={4}>
        <TileLayer url="https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" />
        {stats &&
          maxConfirmed &&
          stats.map((stat, i) => {
            const radius =
              (getDataFromDaysAgo(stat, "confirmed") / maxConfirmed) * 70
            const coords = [stat.lat, stat.lng]
            return (
              <CircleMarker
                key={i}
                color="#d20962"
                center={coords}
                radius={radius < 5 ? 5 : radius}
                onmouseover={e => e.target.openPopup()}
                onmouseout={e => e.target.closePopup()}
                onClick={e => mapRef.current.leafletElement.setView(coords, 6)}>
                <Popup>
                  <div className="popup">
                    {stat.state && <h4>{stat.country}</h4>}
                    <h3>{stat.state || stat.country}</h3>
                    <table>
                      <tbody>
                        <tr>
                          <td>Infections</td>
                          <td>
                            {numberWithCommas(
                              getDataFromDaysAgo(stat, "confirmed")
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td>Deaths</td>
                          <td>
                            {numberWithCommas(
                              getDataFromDaysAgo(stat, "deaths")
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td>Recovered</td>
                          <td>
                            {numberWithCommas(
                              getDataFromDaysAgo(stat, "recovered")
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
      </Map>
      <div className="search">
        <h1>COVID-19 Tracker</h1>
        <div className="bar">
          <input
            type="text"
            placeholder="Search"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {searchResults && (
          <div className="results">
            {searchResults.map(stat => (
              <button
                onClick={e => {
                  e.preventDefault()
                  setSearchTerm("")
                  mapRef.current.leafletElement.setView([stat.lat, stat.lng], 6)
                }}
                className="result">
                {stat.state && <h4>{stat.country}</h4>}
                <h3>{stat.state || stat.country}</h3>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default App

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value])

  return debouncedValue
}
