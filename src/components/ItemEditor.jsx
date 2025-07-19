import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'

function ItemEditor() {
    const { itemId } = useParams()
    const [item, setItem] = useState(null)

    useEffect(() => {
        // Get specific item data for editing
        // You'll need to add this to your preload/IPC
        window.electronAPI.getItem(itemId).then(setItem)
    }, [itemId])

    if (!item) return <div>Loading...</div>

    return (
        <div>
            <h1>Editing: {item.name}</h1>
            {/* Your editor form here */}
        </div>
    )
}

export default ItemEditor