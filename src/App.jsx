import "./App.css"
import { useEffect, useState } from "react"
import ItemIcon from "./components/ItemIcon"

function App() {
    const [items, setItems] = useState([])

    useEffect(() => {
        //wait for signle
        window.package.onPackageLoaded((loadedItems) => {
            setItems(loadedItems || [])
        })
    }, [])

    return (
        <>
            <div className="items-grid">
                {items.map((item) => (
                    <ItemIcon key={item.id} item={item} />
                ))}
            </div>
        </>
    )
}

export default App
