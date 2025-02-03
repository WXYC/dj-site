"use client";

import Head from "next/head";

const SITE_TITLE = "WXYC";

interface DJSitePageProps {
    title: string;
}

const PageData = (props: DJSitePageProps): JSX.Element => {
    return (
        <Head>
            <title>{SITE_TITLE} | {props.title}</title>
        </Head>
    );
};

export default PageData;