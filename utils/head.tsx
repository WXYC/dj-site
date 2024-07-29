"use client";

import Head from "next/head";

const SITE_TITLE = "WXYC Chapel Hill";

interface DJSitePageProps {
    title: string;
}

const PageHeader = (props: DJSitePageProps): JSX.Element => {
    return (
        <Head>
            <title>{props.title}</title>
        </Head>
    );
};

export default PageHeader;