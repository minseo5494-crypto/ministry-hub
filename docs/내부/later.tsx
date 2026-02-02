import { redirect } from "next/navigation"


export const page = () => {
    redirect('/main')
    return null
}