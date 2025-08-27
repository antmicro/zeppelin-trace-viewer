/*
 * Copyright (c) 2025 Analog Devices, Inc.
 * Copyright (c) 2025 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */


/**
 * The module with tiling manager layout.
 */

import { ComponentChild, RefObject } from "preact";
import { memo, useImperativeHandle } from "preact/compat";
import { Action, Actions, DockLocation, IJsonModel, ITabRenderValues, Layout, Model, Node, Orientation, TabNode } from "flexlayout-react";
import { metadataAtom } from "@speedscope/app-state";

import style from "@styles/app.module.scss";
import Speedscope from "./speedscope";
// Import all panels to make sure they are registered
import * as panels from "./info-panel";
import { TilingComponent, getAllComponents, getTilingComponent } from "./utils/tiling-component";
import { getDraggedButtonTitle } from "./top-bar/tiling-component-button";
import PanelIcon from "./icons/panel-icon";


const InfoPanel = panels.InfoPanel;

/** The functions managing tiling layout state available from outside the component */
export interface TilingRef {
    /** Adds new panel with a given component */
    addNode: (type_: TilingComponent<any>) => void,
    /** Removes all panel with a given type */
    removeNode: (type_: TilingComponent<any>) => void,
}


export interface TilingLayoutProps {
    /** The reference that will contain tiling layout methods */
    tilingRef: RefObject<TilingRef>,
}

/** The schema of initial layout */
const initLayout: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        // horizontal row
        type: "row",
        children: [
            {
                // vertical row
                type: "row",
                children: [
                    {
                        type: "tabset",
                        children: [Speedscope.createJSONNode()],
                    },
                    {
                        type: "tabset",
                        children: [InfoPanel.createJSONNode()],
                    },
                ],
            },
        ],
    },
};
// Increase instance quantity for initial components
[Speedscope, InfoPanel].forEach(component => component.instances.set(1));


/**
 * The upper limit of nodes in one row when spawning new elements.
 * When the limit is exceeded, nodes are added to the last tabset.
 */
const MAX_NODES_IN_ROW_FOR_SPAWNING = 3;


/**
 * The tiling manager layout based on FlexLayout library.
 *
 * It has to be stateless, otherwise Speedscope reloads (when the state is updated)
 * which leads to circular dependencies and infinite reloads.
 */
export default memo(({tilingRef}: TilingLayoutProps) => {
    useImperativeHandle(tilingRef, () => {
        return {
            addNode,
            removeNode,
        };
    }, []);

    const model = Model.fromJson(initLayout);
    // Retrieve node with InfoPanel and speedscope
    let infoPanelTab: TabNode;
    let speedscopeTab: TabNode;
    model.visitNodes((n, _l) => {
        if (!(n instanceof TabNode)) {return;}
        const comp = n.getAttr("component") as string | undefined;
        if (comp === InfoPanel.title) {(infoPanelTab = n);}
        else if (comp === Speedscope.title) {(speedscopeTab = n);}
    });

    /**
     * Adds node to the parent of InfoPanel.
     * If there is no data for new node, it will not be created.
     */
    function addNode<T>(type_: TilingComponent<T>) {
        // Choose info panel (if it's present on the same window as Speedscope) or fallback to speedscope
        let parentNode: Node | undefined = (
            model.getNodeById(infoPanelTab.getId()) && speedscopeTab.getWindowId() === infoPanelTab.getWindowId()
        ) ? infoPanelTab : speedscopeTab;
        while (
            parentNode &&
            // Get next parent as long as current node is tab or is not horizontal
            (parentNode.getType() === "tab" || parentNode?.getOrientation() !== Orientation.HORZ)
        ) { parentNode = parentNode?.getParent();}
        if (model.getRoot().getId() === parentNode?.getId()) { parentNode = infoPanelTab.getParent(); }
        if (!parentNode) {
            console.warn("Parent of info panel is missing - new nodes will not be added");
            return;
        }

        const children = parentNode.getChildren();
        const tooManyNodes = (children.length ?? 0) >= MAX_NODES_IN_ROW_FOR_SPAWNING;
        // doAction does not trigger onAction callback, therefore instance count has to be increased manually
        type_.incrInstances();
        const addedNode = model.doAction(Actions.addNode(
            type_.createJSONNode(),
            (tooManyNodes ? children[children.length - 1].getId() : parentNode.getId()),
            (tooManyNodes ? DockLocation.CENTER : DockLocation.RIGHT),
            -1,
            true,
        )) as (Node | undefined);

        if (!addedNode) {
            console.error(`Node ${type_.title} has not been added`);
        }
    };
    /** Removes all panel with the given type */
    function removeNode<T>(type_: TilingComponent<T>) {
        model.visitNodes(n => {
            if (n.getAttr("component") === type_.title) {
                // doAction does not trigger onAction callback, therefore instance count has to be decreased manually
                type_.decrInstances();
                model.doAction(Actions.deleteTab(n.getId()));
            }
        });
    };

    /** Factory creating new tiles based on a node definition */
    const factory = (node: TabNode): ComponentChild => {
        const component = node.getComponent();
        if (component === undefined) {
            console.warn("Factory: component not defined");
            return;
        }
        const tilingComponent = getTilingComponent(component);
        const ComponentType = tilingComponent?.component;
        if (!ComponentType) {
            console.warn(`Factory: component '${component}' not registered`);
            return;
        }

        return <ComponentType {...(node.getConfig() ?? {})} />;
    };

    // Actions when new trace is loaded
    metadataAtom.subscribe(() => {
        // Delete all panels apart from Speedscope and info panel
        getAllComponents().filter((v) => ![Speedscope, InfoPanel].includes(v as TilingComponent<object>)).forEach(removeNode);

        // On each metadata update, create available panels
        getAllComponents().filter((v) => ![Speedscope, InfoPanel].includes(v as TilingComponent<object>) && v.available.get()).forEach(addNode);

    });

    /** External drag callback, that spawns new panel if a button associated with a component is dragged */
    const onExternalDrag = (_) => {
        const draggedButton = getDraggedButtonTitle();
        if (!draggedButton) {return undefined;}
        const json = getTilingComponent(draggedButton)?.createJSONNode();
        if (!json) {return undefined;}
        return {json};
    };

    /** On action callback that increases and decreases number of components instances */
    const onAction = (a: Action) => {
        if (a.type === Actions.ADD_NODE && "component" in a.data.json) {
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */
            const tilingComponent = getTilingComponent(a.data.json.component as string);
            if (tilingComponent) {
                tilingComponent.incrInstances();
            }
        } else if (a.type === Actions.DELETE_TAB) {
            const n = model.getNodeById(a.data.node as string);
            const tilingComponent = getTilingComponent(n?.getAttr("component") as string);
            if (tilingComponent) {
                tilingComponent.decrInstances();
            }
        }
        return a;
    };

    const onRenderTab = (_node: TabNode, renderValues: ITabRenderValues) => {
        renderValues.leading = <PanelIcon />;
    };

    return (
        <div id={style['tiling-layout']}>
            <Layout
                model={model}
                factory={factory}
                popoutWindowName="Zeppelin Trace Viewer"
                realtimeResize={true}
                onExternalDrag={onExternalDrag}
                onAction={onAction}
                onRenderTab={onRenderTab}
            />
        </div>
    );
// Override props comparison to avoid unnecessary reloads
}, (_prev, _new) => true);

