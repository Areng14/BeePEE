import { Button, Box } from "@mui/material"
import { Edit } from "@mui/icons-material"
import { useState, useEffect } from "react"
import missingIcon from "../assets/missing.png"

function ItemIcon({ item, onEdit }) {
    const [imageSrc, setImageSrc] = useState(null)
    const [imageError, setImageError] = useState(false)

    useEffect(() => {
        if (item.icon) {
            window.package.loadFile(item.icon)
                .then(setImageSrc)
                .catch((error) => {
                    console.warn(`Failed to load icon for item ${item.name}:`, error)
                    setImageError(true)
                    setImageSrc(null)
                })
        } else {
            setImageSrc(null)
            setImageError(false)
        }
    }, [item.icon])

    const handleImageError = () => {
        setImageError(true)
    }

    return (
        <Button
            className="item-icon"
            onClick={onEdit}
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
                "&.MuiButton-root": {
                    width: 96,
                    height: 96,
                    minWidth: 96,
                    minHeight: 96,
                },
                "&:hover": {
                    "& img": {
                        filter: "brightness(0.3)",
                    },
                    "& .edit-icon": {
                        opacity: 1,
                    },
                },
            }}>
            <img
                src={imageSrc || missingIcon}
                alt={item.name}
                onError={handleImageError}
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transition: "filter 0.2s ease",
                }}
            />

            <Box
                className="edit-icon"
                sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    opacity: 0,
                    transition: "opacity 0.2s ease",
                    pointerEvents: "none",
                }}>
                <Edit sx={{ color: "white", fontSize: 32 }} />
            </Box>
        </Button>
    )
}

export default ItemIcon
