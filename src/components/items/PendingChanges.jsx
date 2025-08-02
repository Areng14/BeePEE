import {
    Box,
    Typography,
    Stack,
    Paper,
    Chip,
    Divider,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Alert,
    IconButton,
    Tooltip,
} from "@mui/material"
import {
    Person,
    DriveFileRenameOutline,
    Description,
    Image,
    Add,
    Remove,
    SwapHoriz,
    CheckCircle,
    Info,
    ViewInAr,
    Input as InputIcon,
    Code,
    Construction,
    Undo,
} from "@mui/icons-material"

function PendingChanges({ item, deferredChanges, onUndo }) {
    const hasBasicInfoChanges = 
        deferredChanges?.basicInfo?.name !== undefined ||
        deferredChanges?.basicInfo?.author !== undefined ||
        deferredChanges?.basicInfo?.description !== undefined ||
        deferredChanges?.basicInfo?.icon

    const hasInstanceChanges = 
        deferredChanges?.instances?.added?.length > 0 ||
        deferredChanges?.instances?.removed?.length > 0 ||
        deferredChanges?.instances?.replaced?.length > 0

    const hasInputChanges = deferredChanges?.inputs && Object.keys(deferredChanges.inputs).length > 0
    const hasVbspChanges = deferredChanges?.vbsp && Object.keys(deferredChanges.vbsp).length > 0
    const hasOtherChanges = deferredChanges?.other && Object.keys(deferredChanges.other).length > 0

    const hasAnyChanges = hasBasicInfoChanges || hasInstanceChanges || hasInputChanges || hasVbspChanges || hasOtherChanges

    if (!hasAnyChanges) {
        return (
            <Box sx={{ p: 3, textAlign: "center" }}>
                <CheckCircle sx={{ fontSize: 64, color: "success.main", mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                    No Pending Changes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    All changes have been applied or there are no modifications yet.
                </Typography>
            </Box>
        )
    }

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Pending Changes Preview
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Review all changes that will be applied when you press the Apply button.
            </Typography>

            <Stack spacing={3}>
                {/* Basic Information Changes */}
                {hasBasicInfoChanges && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle1" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Info /> Basic Information Changes
                        </Typography>
                        <List dense>
                            {deferredChanges?.basicInfo?.name !== undefined && (
                                <ListItem>
                                    <ListItemIcon>
                                        <DriveFileRenameOutline color="info" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Name"
                                        secondary={
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Typography variant="body2" sx={{ textDecoration: "line-through", color: "text.disabled" }}>
                                                    {item?.name || "(empty)"}
                                                </Typography>
                                                <Typography variant="body2">→</Typography>
                                                <Typography variant="body2" color="primary" fontWeight="bold">
                                                    {deferredChanges.basicInfo.name || "(empty)"}
                                                </Typography>
                                            </Stack>
                                        }
                                    />
                                    <Tooltip title="Undo this change">
                                        <IconButton 
                                            size="small"
                                            onClick={() => onUndo('basicInfo', 'name')}
                                        >
                                            <Undo fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </ListItem>
                            )}
                            
                            {deferredChanges?.basicInfo?.author !== undefined && (
                                <ListItem>
                                    <ListItemIcon>
                                        <Person color="info" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Author"
                                        secondary={
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Typography variant="body2" sx={{ textDecoration: "line-through", color: "text.disabled" }}>
                                                    {item?.details?.Authors || "(empty)"}
                                                </Typography>
                                                <Typography variant="body2">→</Typography>
                                                <Typography variant="body2" color="primary" fontWeight="bold">
                                                    {deferredChanges.basicInfo.author || "(empty)"}
                                                </Typography>
                                                                                        </Stack>
                                        }
                                    />
                                    <Tooltip title="Undo this change">
                                        <IconButton 
                                            size="small"
                                            onClick={() => onUndo('basicInfo', 'author')}
                                        >
                                            <Undo fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </ListItem>
                            )}
                            
                            {deferredChanges?.basicInfo?.description !== undefined && (
                                <ListItem>
                                    <ListItemIcon>
                                        <Description color="info" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Description"
                                        secondary={
                                            <Stack spacing={1}>
                                                <Typography variant="body2" color="text.disabled">
                                                    Old: {item?.details?.Description ? 
                                                        (typeof item.details.Description === 'object' ? 
                                                            Object.keys(item.details.Description)
                                                                .filter(key => key.startsWith("desc_"))
                                                                .sort()
                                                                .map(key => item.details.Description[key])
                                                                .join(" ") 
                                                            : item.details.Description)
                                                        : "(empty)"
                                                    }
                                                </Typography>
                                                <Typography variant="body2" color="primary" fontWeight="bold">
                                                    New: {deferredChanges.basicInfo.description || "(empty)"}
                                                </Typography>
                                            </Stack>
                                        }
                                    />
                                    <Tooltip title="Undo this change">
                                        <IconButton 
                                            size="small"
                                            onClick={() => onUndo('basicInfo', 'description')}
                                        >
                                            <Undo fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </ListItem>
                            )}

                            {deferredChanges?.basicInfo?.icon && (
                                <ListItem>
                                    <ListItemIcon>
                                        <Image color="info" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Icon"
                                        secondary="Icon will be updated via file browser"
                                    />
                                    <Tooltip title="Undo this change">
                                        <IconButton 
                                            size="small"
                                            onClick={() => onUndo('basicInfo', 'icon')}
                                        >
                                            <Undo fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </ListItem>
                            )}
                        </List>
                    </Paper>
                )}

                {/* Instance Changes */}
                {hasInstanceChanges && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle1" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ViewInAr /> Instance Changes
                        </Typography>
                        <List dense>
                            {/* Additions */}
                            {deferredChanges?.instances?.added?.map((addition, index) => (
                                <ListItem key={`add-${index}`}>
                                    <ListItemIcon>
                                        <Add color="success" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={`Add New Instance ${index + 1}`}
                                        secondary="A file dialog will open to select the VMF file"
                                    />
                                    <Tooltip title="Cancel this addition">
                                        <IconButton 
                                            size="small"
                                            onClick={() => onUndo('instances', 'added', index)}
                                        >
                                            <Undo fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </ListItem>
                            ))}

                            {/* Removals */}
                            {deferredChanges?.instances?.removed?.map((removal, index) => {
                                const instanceName = item?.instances?.[removal.index]?.Name || `Instance ${removal.index}`
                                return (
                                    <ListItem key={`remove-${index}`}>
                                        <ListItemIcon>
                                            <Remove color="error" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={`Remove: ${instanceName}`}
                                            secondary={`Instance at index ${removal.index}`}
                                        />
                                        <Tooltip title="Cancel this removal">
                                            <IconButton 
                                                size="small"
                                                onClick={() => onUndo('instances', 'removed', index)}
                                            >
                                                <Undo fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </ListItem>
                                )
                            })}

                            {/* Replacements */}
                            {deferredChanges?.instances?.replaced?.map((replacement, index) => {
                                const instanceName = item?.instances?.[replacement.index]?.Name || `Instance ${replacement.index}`
                                return (
                                    <ListItem key={`replace-${index}`}>
                                        <ListItemIcon>
                                            <SwapHoriz color="warning" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={`Replace: ${instanceName}`}
                                            secondary={`Instance at index ${replacement.index}`}
                                        />
                                        <Tooltip title="Cancel this replacement">
                                            <IconButton 
                                                size="small"
                                                onClick={() => onUndo('instances', 'replaced', index)}
                                            >
                                                <Undo fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </ListItem>
                                )
                            })}
                        </List>
                    </Paper>
                )}

                {/* Input/Output Changes */}
                {hasInputChanges && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle1" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <InputIcon /> Input/Output Changes
                        </Typography>
                        <List dense>
                            {Object.entries(deferredChanges.inputs).map(([key, value]) => (
                                <ListItem key={key}>
                                    <ListItemIcon>
                                        <InputIcon color="info" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={`Input/Output Configuration`}
                                        secondary={`${key}: ${JSON.stringify(value)}`}
                                    />
                                    <Chip size="small" label="Modified" color="info" variant="outlined" />
                                </ListItem>
                            ))}
                        </List>
                    </Paper>
                )}

                {/* VBSP Changes */}
                {hasVbspChanges && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle1" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Code /> VBSP Configuration Changes
                        </Typography>
                        <List dense>
                            {Object.entries(deferredChanges.vbsp).map(([key, value]) => (
                                <ListItem key={key}>
                                    <ListItemIcon>
                                        <Code color="info" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={`VBSP Setting`}
                                        secondary={`${key}: ${JSON.stringify(value)}`}
                                    />
                                    <Chip size="small" label="Modified" color="info" variant="outlined" />
                                </ListItem>
                            ))}
                        </List>
                    </Paper>
                )}

                {/* Other Changes */}
                {hasOtherChanges && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="subtitle1" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Construction /> Other Settings Changes
                        </Typography>
                        <List dense>
                            {Object.entries(deferredChanges.other).map(([key, value]) => (
                                <ListItem key={key}>
                                    <ListItemIcon>
                                        <Construction color="info" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={`Other Setting`}
                                        secondary={`${key}: ${JSON.stringify(value)}`}
                                    />
                                    <Chip size="small" label="Modified" color="info" variant="outlined" />
                                </ListItem>
                            ))}
                        </List>
                    </Paper>
                )}

                {/* Action Summary */}
                <Alert severity="info">
                    <Typography variant="subtitle2" gutterBottom>
                        Ready to Apply Changes
                    </Typography>
                    <Typography variant="body2">
                        Press the <strong>Apply</strong> button to execute all these changes. 
                        You can continue editing and the changes will remain queued until applied.
                    </Typography>
                </Alert>
            </Stack>
        </Box>
    )
}

export default PendingChanges