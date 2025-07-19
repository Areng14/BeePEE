beforeEach(() => {
    jest.clearAllMocks()
    
    // Also silence console during tests
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
})