import { Button, Box } from "@mui/material"
import { useState, useEffect } from "react"
import missingIcon from "../assets/missing.png"

function SignageIcon({ signage }) {
    const [imageSrc, setImageSrc] = useState(null)
    const [imageError, setImageError] = useState(false)

    useEffect(() => {
        if (signage.icon) {
            window.package.loadFile(signage.icon)
                .then(setImageSrc)
                .catch((error) => {
                    console.warn(`Failed to load icon for signage ${signage.name}:`, error)
                    setImageError(true)
                    setImageSrc(null)
                })
        } else {
            setImageSrc(null)
            setImageError(false)
        }
    }, [signage.icon])

    const handleImageError = () => {
        setImageError(true)
    }

    return (
        <Button
            className="signage-icon"
            sx={{
                width: 96,
                height: 96,
                minWidth: 96,
                minHeight: 96,
                padding: 0,
                border: "1px solid #444",
                borderRadius: 1,
                overflow: "hidden",
                boxSizing: "border-box",
                position: "relative",
                cursor: "default",
                "&.MuiButton-root": {
                    width: 96,
                    height: 96,
                    minWidth: 96,
                    minHeight: 96,
                },
            }}>
            <img
                src={imageSrc || missingIcon}
                alt={signage.name}
                onError={handleImageError}
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                }}
            />
        </Button>
    )
}

export default SignageIcon

