import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import Inputs from "../components/items/Inputs"

// Mock the electron API
const mockElectronAPI = {
    package: {
        getItemEntities: jest.fn(),
        getFgdData: jest.fn(),
    },
}

Object.defineProperty(window, "package", {
    value: mockElectronAPI.package,
})

// Mock data
const mockEntities = {
    button_1: "func_button",
    button_2: "func_button",
    door_1: "func_door",
    trigger_1: "trigger_once",
}

const mockFgdData = {
    func_button: {
        inputs: [
            { name: "Press", needsParam: false },
            { name: "PressIn", needsParam: true },
            { name: "FireUser1", needsParam: true },
        ],
        outputs: [
            { name: "OnPressed", needsParam: false },
            { name: "OnUser1", needsParam: true },
        ],
    },
    func_door: {
        inputs: [
            { name: "Open", needsParam: false },
            { name: "Close", needsParam: false },
        ],
        outputs: [
            { name: "OnOpen", needsParam: false },
            { name: "OnClose", needsParam: false },
        ],
    },
    trigger_once: {
        inputs: [
            { name: "Enable", needsParam: false },
            { name: "Disable", needsParam: false },
        ],
        outputs: [{ name: "OnTrigger", needsParam: false }],
    },
}

const mockItem = {
    id: "TEST_ITEM",
    name: "Test Item",
    inputs: {},
    outputs: {},
}

describe("Inputs Component", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockElectronAPI.package.getItemEntities.mockResolvedValue(mockEntities)
        mockElectronAPI.package.getFgdData.mockResolvedValue(mockFgdData)
    })

    describe("Duplicate Entity Detection", () => {
        test("should detect and mark duplicate entity names with bold text and icon", async () => {
            render(<Inputs item={mockItem} />)

            // Click Add Input to open dialog
            const addInputButton = await screen.findByText("Add Input")
            fireEvent.click(addInputButton)

            // Wait for dialog to load
            await waitFor(() => {
                expect(screen.getByText("Configure Input")).toBeInTheDocument()
            })

            // Open entity dropdown
            const entitySelect = screen.getByLabelText("Enable Entity")
            fireEvent.mouseDown(entitySelect)

            // Check for duplicate indicators on button entities
            await waitFor(() => {
                const buttonOptions = screen.getAllByText(/button_/)
                expect(buttonOptions.length).toBeGreaterThan(0)

                // Should have GroupWork icons for duplicate entities
                const groupIcons = document.querySelectorAll(
                    '[data-testid="GroupWorkIcon"]',
                )
                expect(groupIcons.length).toBeGreaterThan(0)
            })
        })

        test("should not mark single entities as duplicates", async () => {
            render(<Inputs item={mockItem} />)

            const addInputButton = await screen.findByText("Add Input")
            fireEvent.click(addInputButton)

            await waitFor(() => {
                expect(screen.getByText("Configure Input")).toBeInTheDocument()
            })

            const entitySelect = screen.getByLabelText("Enable Entity")
            fireEvent.mouseDown(entitySelect)

            await waitFor(() => {
                // door_1 and trigger_1 are unique, so they shouldn't have group icons
                const doorOption = screen.getByText(/door_1/)
                expect(doorOption.closest("li")).not.toContain(
                    '[data-testid="GroupWorkIcon"]',
                )
            })
        })
    })

    describe("Input Validation", () => {
        test("should disable Add button when no entity is selected", async () => {
            render(<Inputs item={mockItem} />)

            const addInputButton = await screen.findByText("Add Input")
            fireEvent.click(addInputButton)

            await waitFor(() => {
                const addButton = screen.getByRole("button", { name: "Add" })
                expect(addButton).toBeDisabled()
            })
        })

        test("should disable Add button when entity is selected but no input", async () => {
            render(<Inputs item={mockItem} />)

            const addInputButton = await screen.findByText("Add Input")
            fireEvent.click(addInputButton)

            await waitFor(() => {
                expect(screen.getByText("Configure Input")).toBeInTheDocument()
            })

            // Select entity but not input
            const entitySelect = screen.getByLabelText("Enable Entity")
            fireEvent.change(entitySelect, { target: { value: "button_1" } })

            await waitFor(() => {
                const addButton = screen.getByRole("button", { name: "Add" })
                expect(addButton).toBeDisabled()
            })
        })

        test("should enable Add button when valid configuration is provided", async () => {
            render(<Inputs item={mockItem} />)

            const addInputButton = await screen.findByText("Add Input")
            fireEvent.click(addInputButton)

            await waitFor(() => {
                expect(screen.getByText("Configure Input")).toBeInTheDocument()
            })

            // Select entity and input
            const entitySelect = screen.getByLabelText("Enable Entity")
            fireEvent.change(entitySelect, { target: { value: "button_1" } })

            await waitFor(() => {
                const inputSelect = screen.getByLabelText("Enable Input")
                fireEvent.change(inputSelect, { target: { value: "Press" } })
            })

            await waitFor(() => {
                const addButton = screen.getByRole("button", { name: "Add" })
                expect(addButton).toBeEnabled()
            })
        })

        test("should require parameter when input needs one", async () => {
            render(<Inputs item={mockItem} />)

            const addInputButton = await screen.findByText("Add Input")
            fireEvent.click(addInputButton)

            await waitFor(() => {
                expect(screen.getByText("Configure Input")).toBeInTheDocument()
            })

            // Select entity and input that needs parameter
            const entitySelect = screen.getByLabelText("Enable Entity")
            fireEvent.change(entitySelect, { target: { value: "button_1" } })

            await waitFor(() => {
                const inputSelect = screen.getByLabelText("Enable Input")
                fireEvent.change(inputSelect, { target: { value: "PressIn" } })
            })

            // Should be disabled without parameter
            await waitFor(() => {
                const addButton = screen.getByRole("button", { name: "Add" })
                expect(addButton).toBeDisabled()
            })

            // Add parameter
            const paramField = screen.getByLabelText("Parameter")
            fireEvent.change(paramField, { target: { value: "test_param" } })

            // Should now be enabled
            await waitFor(() => {
                const addButton = screen.getByRole("button", { name: "Add" })
                expect(addButton).toBeEnabled()
            })
        })
    })

    describe("Output Validation", () => {
        test("should validate output configuration correctly", async () => {
            render(<Inputs item={mockItem} />)

            // Switch to Output tab
            const outputTab = screen.getByRole("tab", { name: /output/i })
            fireEvent.click(outputTab)

            const addOutputButton = await screen.findByText("Add Output")
            fireEvent.click(addOutputButton)

            await waitFor(() => {
                expect(screen.getByText("Configure Output")).toBeInTheDocument()
            })

            // Should be disabled initially
            await waitFor(() => {
                const addButton = screen.getByRole("button", { name: "Add" })
                expect(addButton).toBeDisabled()
            })

            // Select entity and output
            const entitySelect = screen.getByLabelText("Activate Entity")
            fireEvent.change(entitySelect, { target: { value: "button_1" } })

            await waitFor(() => {
                const outputSelect = screen.getByLabelText("Activate Output")
                fireEvent.change(outputSelect, {
                    target: { value: "OnPressed" },
                })
            })

            // Should now be enabled
            await waitFor(() => {
                const addButton = screen.getByRole("button", { name: "Add" })
                expect(addButton).toBeEnabled()
            })
        })
    })

    describe("Dual Input Validation", () => {
        test("should validate dual input configuration", async () => {
            render(<Inputs item={mockItem} />)

            const addInputButton = await screen.findByText("Add Input")
            fireEvent.click(addInputButton)

            await waitFor(() => {
                expect(screen.getByText("Configure Input")).toBeInTheDocument()
            })

            // Select DUAL type
            const typeSelect = screen.getByLabelText("Type")
            fireEvent.change(typeSelect, { target: { value: "DUAL" } })

            // Should be disabled without both enable and disable configs
            await waitFor(() => {
                const addButton = screen.getByRole("button", { name: "Add" })
                expect(addButton).toBeDisabled()
            })

            // Configure enable
            const enableEntitySelect = screen.getByLabelText("Enable Entity")
            fireEvent.change(enableEntitySelect, {
                target: { value: "button_1" },
            })

            await waitFor(() => {
                const enableInputSelect = screen.getByLabelText("Enable Input")
                fireEvent.change(enableInputSelect, {
                    target: { value: "Press" },
                })
            })

            // Still disabled without disable config
            await waitFor(() => {
                const addButton = screen.getByRole("button", { name: "Add" })
                expect(addButton).toBeDisabled()
            })

            // Configure disable
            const disableEntitySelect = screen.getByLabelText("Disable Entity")
            fireEvent.change(disableEntitySelect, {
                target: { value: "button_2" },
            })

            await waitFor(() => {
                const disableInputSelect =
                    screen.getByLabelText("Disable Input")
                fireEvent.change(disableInputSelect, {
                    target: { value: "Press" },
                })
            })

            // Should now be enabled
            await waitFor(() => {
                const addButton = screen.getByRole("button", { name: "Add" })
                expect(addButton).toBeEnabled()
            })
        })
    })

    describe("Validation Error Messages", () => {
        test("should show specific error message in tooltip when hovering disabled button", async () => {
            render(<Inputs item={mockItem} />)

            const addInputButton = await screen.findByText("Add Input")
            fireEvent.click(addInputButton)

            await waitFor(() => {
                expect(screen.getByText("Configure Input")).toBeInTheDocument()
            })

            const addButton = screen.getByRole("button", { name: "Add" })

            // Hover over disabled button
            fireEvent.mouseEnter(addButton)

            await waitFor(() => {
                expect(
                    screen.getByText("Please select an enable entity"),
                ).toBeInTheDocument()
            })
        })

        test("should show parameter required message", async () => {
            render(<Inputs item={mockItem} />)

            const addInputButton = await screen.findByText("Add Input")
            fireEvent.click(addInputButton)

            await waitFor(() => {
                expect(screen.getByText("Configure Input")).toBeInTheDocument()
            })

            // Select entity and input that needs parameter
            const entitySelect = screen.getByLabelText("Enable Entity")
            fireEvent.change(entitySelect, { target: { value: "button_1" } })

            await waitFor(() => {
                const inputSelect = screen.getByLabelText("Enable Input")
                fireEvent.change(inputSelect, { target: { value: "PressIn" } })
            })

            const addButton = screen.getByRole("button", { name: "Add" })
            fireEvent.mouseEnter(addButton)

            await waitFor(() => {
                expect(
                    screen.getByText("This input requires a parameter"),
                ).toBeInTheDocument()
            })
        })
    })

    describe("Parameter Field Behavior", () => {
        test("should disable parameter field when input does not need parameter", async () => {
            render(<Inputs item={mockItem} />)

            const addInputButton = await screen.findByText("Add Input")
            fireEvent.click(addInputButton)

            await waitFor(() => {
                expect(screen.getByText("Configure Input")).toBeInTheDocument()
            })

            // Select entity and input that doesn't need parameter
            const entitySelect = screen.getByLabelText("Enable Entity")
            fireEvent.change(entitySelect, { target: { value: "button_1" } })

            await waitFor(() => {
                const inputSelect = screen.getByLabelText("Enable Input")
                fireEvent.change(inputSelect, { target: { value: "Press" } })
            })

            // Parameter field should be disabled
            await waitFor(() => {
                const paramField = screen.getByLabelText("Parameter")
                expect(paramField).toBeDisabled()
                expect(paramField.placeholder).toBe("not required")
            })
        })

        test("should enable parameter field when input needs parameter", async () => {
            render(<Inputs item={mockItem} />)

            const addInputButton = await screen.findByText("Add Input")
            fireEvent.click(addInputButton)

            await waitFor(() => {
                expect(screen.getByText("Configure Input")).toBeInTheDocument()
            })

            // Select entity and input that needs parameter
            const entitySelect = screen.getByLabelText("Enable Entity")
            fireEvent.change(entitySelect, { target: { value: "button_1" } })

            await waitFor(() => {
                const inputSelect = screen.getByLabelText("Enable Input")
                fireEvent.change(inputSelect, { target: { value: "PressIn" } })
            })

            // Parameter field should be enabled
            await waitFor(() => {
                const paramField = screen.getByLabelText("Parameter")
                expect(paramField).toBeEnabled()
                expect(paramField.placeholder).toBe("param")
            })
        })
    })
})
