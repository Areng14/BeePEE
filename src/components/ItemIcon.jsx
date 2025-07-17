import { useState, useEffect } from "react"

function ItemIcon({ item }) {
    const [imageSrc, setImageSrc] = useState(null)

    useEffect(() => {
        if (item.icon) {
            window.package.loadFile(item.icon).then(setImageSrc)
        }
    }, [item.icon])

    return (
        <img
            src={imageSrc || "placeholder.png"}
            alt={item.name}
            className="item-icon"
        />
    )
}

export default ItemIcon
