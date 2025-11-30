export async function guessGender(name: string): Promise<string> {
    // Placeholder implementation
    // In a real app, this would call an API like Genderize.io
    const commonMaleNames = ['john', 'david', 'michael', 'james', 'robert']
    const commonFemaleNames = ['mary', 'jennifer', 'linda', 'patricia', 'elizabeth']

    const lowerName = name.toLowerCase()

    if (commonMaleNames.includes(lowerName)) return 'male'
    if (commonFemaleNames.includes(lowerName)) return 'female'

    return 'unknown'
}
