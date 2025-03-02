import { getProperty, getActionString } from '../Common.js';
import SubNavItemList from './SubNavItemList.js'

export default function SidebarNavItem(props, mode=0) {
    if (Object.keys(props).length == 0) {
        return ``
    }


    const name = "SidebarNavItem"
    const id = getProperty(props, "id", `${name.toLowerCase()}-node`)
    const actions = getProperty(props, "actions", {})

    let itemClass = getProperty(props, "itemClass", "nav-item")
    let href = getProperty(props, "href", "#")
    let navLinkClass = getProperty(props, "navLinkClass", "nav-link")
    let itemIconClass = getProperty(props, "itemIconClass", "nav-icon fas fa-copy")
    let subIconClass = getProperty(props, "subIconClass", null)
    let text = getProperty(props, "text", "Layout Options")
    let spanClass = getProperty(props, "spanClass", null)
    let spanText = getProperty(props, "spanText", "")
    let subNavItemList = getProperty(props, "subNavItemList", [])
    let position = getProperty(props, "postion", 0)


    let actionString = getActionString(actions, { "@id": id })
    actionString = actionString.length > 0 ? actionString : '';


    function Span(spanClass, spanText) {

        return (spanClass && !spanClass !== "") ? (`<span class="${spanClass}">${spanText}</span>`) : ""
    }


    function Icon(iconClass) {

        return (iconClass && iconClass !== "") ? (`<i class="${iconClass}"></i>`) : ""

    }
    const display = () => {
        if (subNavItemList.length > 0) {

            return (
                `<li  id="${id}" class="${itemClass}">
                    <a  id="${id}-link" href="${href}" class="${navLinkClass}" ${actionString}>
                        <i class="${itemIconClass}"></i>
                        <p>
                            ${text}
                            ${Icon(subIconClass)}
                            ${Span(spanClass, spanText)}
                        </p>
                    </a>
               ${SubNavItemList(subNavItemList, id)}
            </li>`
            )

        } else {
            return (`<li  id="${id}" class="${itemClass}">
            <a  id="${id}-link" href="${href}" class="${navLinkClass}" ${actionString}>
                <i class="${itemIconClass}"></i>
                <p>
                    ${text}
                    ${Icon(subIconClass)}
                    ${Span(spanClass, spanText)}
                </p>
            </a>    
        </li>`)
        }
    }

    const update  = () => {
        if (subNavItemList.length > 0) {

            return (
                `<a  id="${id}-link" href="${href}" class="${navLinkClass}" ${actionString}>
                        <i class="${itemIconClass}"></i>
                        <p>
                            ${text}
                            ${Icon(subIconClass)}
                            ${Span(spanClass, spanText)}
                        </p>
                    </a>
               ${SubNavItemList(subNavItemList, id)}
            `
            )

        } else {
            return (` <a  id="${id}-link" href="${href}" class="${navLinkClass}" ${actionString}>
                <i class="${itemIconClass}"></i>
                <p>
                    ${text}
                    ${Icon(subIconClass)}
                    ${Span(spanClass, spanText)}
                </p>
            </a>    
        `)
        }
    }

    if (mode== 0){ 
        return display()
    }else{
        return update()
    }


}
